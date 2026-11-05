#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LabDrop | 1РУП8 — Премиальный локальный веб-сервис быстрой сдачи практических работ.
Архитектура: Strix Defensive SecOps Compliance & Zero-Dependency Python.
Разработчики: Савченков Артем и Алиев Марат (группа 1РУП8)

Запуск:
    python server.py
    (или python server.py 8080)
"""

import os
import sys
import re
import csv
import json
import socket
import time
import datetime
import html
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from collections import defaultdict

# Безопасная кодировка для консоли Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Базовые директории и константы
DEFAULT_PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TASKS_DIR = os.path.normpath(os.path.join(BASE_DIR, "tasks"))
UPLOADS_DIR = os.path.normpath(os.path.join(BASE_DIR, "uploads"))
LOG_CSV_PATH = os.path.normpath(os.path.join(BASE_DIR, "submissions_log.csv"))

# Разрешенные расширения (строгий белый список Strix)
ALLOWED_EXTENSIONS = {".docx", ".doc", ".pdf", ".py", ".zip", ".rar", ".txt"}
DANGEROUS_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".vbs", ".msi", ".scr", ".pif", ".com",
    ".js", ".vbe", ".wsf", ".hta", ".jar", ".ps1", ".php", ".jsp", ".asp"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Список группы 1РУП8 (15 студентов)
STUDENTS_1RUP8 = [
    "Алиев Марат",
    "Борисов Дмитрий",
    "Васильев Иван",
    "Григорьев Максим",
    "Дмитриев Кирилл",
    "Ермаков Алексей",
    "Жуков Роман",
    "Иванов Сергей",
    "Ковалев Даниил",
    "Морозов Никита",
    "Новиков Денис",
    "Петров Александр",
    "Савченков Артем",
    "Смирнов Владислав",
    "Федоров Михаил"
]

# Инициализация каталогов
os.makedirs(TASKS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Инициализация CSV журнала
if not os.path.exists(LOG_CSV_PATH):
    with open(LOG_CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Дата и время", "Студент", "Номер работы", "Имя сохраненного файла", "Размер (КБ)"])

# В памяти: простейший скользящий Rate Limiter (защита от DoS / спама)
RATE_LIMIT_STORE = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = 60


def check_rate_limit(client_ip: str) -> bool:
    """Проверка лимита запросов для IP-адреса."""
    now = time.time()
    RATE_LIMIT_STORE[client_ip] = [t for t in RATE_LIMIT_STORE[client_ip] if now - t < 60]
    if len(RATE_LIMIT_STORE[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
        return False
    RATE_LIMIT_STORE[client_ip].append(now)
    return True


def sanitize_csv_field(val: str) -> str:
    """
    Strix Vector 3: Защита от CSV/Excel Formula Injection (DDE).
    Предотвращает выполнение формул (=cmd|..., @SUM, +123, -2+3) при открытии в MS Excel.
    """
    s = str(val).strip()
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


def sanitize_text_input(val: str, max_len: int = 100) -> str:
    """Strix Vector 4: Очистка текста от HTML/XSS тегов и ограничение длины."""
    if not val:
        return ""
    # Удаляем управляющие и нулевые байты
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", val)
    cleaned = html.escape(cleaned.strip())[:max_len]
    return cleaned


def get_local_ips():
    """Определение доступных IP-адресов машины для локальной сети кабинета."""
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and not ip.startswith("169.254."):
                ips.append(ip)
    except Exception:
        pass
    if not ips:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
            s.close()
        except Exception:
            ips.append("127.0.0.1")
    return list(dict.fromkeys(ips))


def parse_multipart_data(body: bytes, boundary: str):
    """
    Автономный парсер multipart/form-data.
    Корректно извлекает UTF-8 поля и бинарные файлы любого объема.
    """
    fields = {}
    files = {}

    delim = b"--" + boundary.encode("latin1")
    parts = body.split(delim)

    for part in parts:
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]

        if not part or part == b"--":
            continue

        header_data, sep, content = part.partition(b"\r\n\r\n")
        if not sep:
            continue

        headers_text = header_data.decode("latin1", errors="replace")
        lines = headers_text.split("\r\n")

        cd_line = next((line for line in lines if line.lower().startswith("content-disposition:")), "")
        if not cd_line:
            continue

        name_match = re.search(r'name=["\']?([^"\';]+)["\']?', cd_line)
        if not name_match:
            continue
        field_name = name_match.group(1)

        # Проверка filename* (RFC 5987) и обычного filename
        fn_star_match = re.search(r"filename\*=UTF-8''([^;\r\n]+)", cd_line, re.IGNORECASE)
        fn_match = re.search(r'filename=["\']?([^"\';]+)["\']?', cd_line)

        if fn_star_match:
            filename = urllib.parse.unquote(fn_star_match.group(1))
        elif fn_match:
            raw_fn = fn_match.group(1)
            try:
                filename = raw_fn.encode("latin1").decode("utf-8")
            except Exception:
                filename = raw_fn
        else:
            filename = None

        if filename is not None:
            files[field_name] = {
                "filename": filename,
                "content": content
            }
        else:
            try:
                text_val = content.decode("utf-8")
            except UnicodeDecodeError:
                text_val = content.decode("latin1", errors="replace")
            fields[field_name] = text_val

    return fields, files


def generate_unique_filename(surname: str, task_num: str, ext: str) -> str:
    """
    Формирует имя по стандарту колледжа: 1RUP8_<Фамилия>_Работа<Номер>.<расширение>
    Защита от затирания версий (_v2, _v3...).
    """
    safe_surname = re.sub(r"[^a-zA-Zа-яА-ЯёЁ0-9\-]", "", surname.strip())
    if not safe_surname:
        safe_surname = "Студент"

    clean_ext = ext.lower().strip()
    base_name = f"1RUP8_{safe_surname}_Работа{task_num}"
    candidate = f"{base_name}{clean_ext}"
    target_path = os.path.join(UPLOADS_DIR, candidate)

    if not os.path.exists(target_path):
        return candidate

    version = 2
    while True:
        candidate_v = f"{base_name}_v{version}{clean_ext}"
        if not os.path.exists(os.path.join(UPLOADS_DIR, candidate_v)):
            return candidate_v
        version += 1


class LabDropHandler(BaseHTTPRequestHandler):
    """
    Обработчик HTTP запросов LabDrop с полным комплексом Strix SecOps защиты.
    """

    def log_message(self, format, *args):
        now = datetime.datetime.now().strftime("%H:%M:%S")
        sys.stderr.write(f"[{now}] {self.address_string()} - {args[0]} {args[1]}\n")

    def _apply_security_headers(self):
        """Strix Vector 5: Полный набор строгих HTTP-заголовков безопасности."""
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self' 'unsafe-inline' data: blob:; "
            "img-src 'self' data: blob:; "
            "font-src 'self' data:; "
            "object-src 'none'; "
            "frame-ancestors 'none';"
        )
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    def _send_json(self, status_code: int, data: dict):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._apply_security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def _serve_file(self, file_path: str, content_type: str, as_attachment=False, download_name=None):
        """
        Strix Vector 1: Безопасная отдача файлов с проверкой выхода за пределы директории.
        """
        norm_path = os.path.normpath(file_path)
        try:
            common = os.path.commonpath([norm_path, BASE_DIR])
            if common != BASE_DIR or not os.path.exists(norm_path) or os.path.isdir(norm_path):
                self._send_safe_error(404, "Файл не найден")
                return
        except Exception:
            self._send_safe_error(404, "Файл не найден")
            return

        file_size = os.path.getsize(norm_path)
        self.send_response(200)
        self._apply_security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")

        if as_attachment:
            safe_fn = download_name or os.path.basename(norm_path)
            encoded_fn = urllib.parse.quote(safe_fn)
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{encoded_fn}")

        self.end_headers()

        with open(norm_path, "rb") as f:
            while chunk := f.read(64 * 1024):
                self.wfile.write(chunk)

    def _send_safe_error(self, code: int, message: str):
        """Безопасная отправка ошибок без latin-1 падений."""
        html_body = f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>{code} Ошибка</title></head>
<body style="font-family:sans-serif;background:#0f172a;color:#fff;padding:40px;text-align:center;">
  <h1 style="color:#ef4444;">{code}</h1>
  <p>{html.escape(message)}</p>
  <p><a href="/" style="color:#38bdf8;">Вернуться на главную LabDrop</a></p>
</body>
</html>""".encode("utf-8")

        self.send_response(code, "Error")
        self._apply_security_headers()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html_body)))
        self.end_headers()
        self.wfile.write(html_body)

    def do_OPTIONS(self):
        """CORS Preflight."""
        self.send_response(200)
        self._apply_security_headers()
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        client_ip = self.client_address[0]
        if not check_rate_limit(client_ip):
            self._send_json(429, {"status": "error", "message": "Слишком много запросов. Подождите минуту."})
            return

        parsed = urllib.parse.urlparse(self.path)
        clean_path = urllib.parse.unquote(parsed.path)

        # Strix Vector 1: Пресечение Path Traversal в URL
        if ".." in clean_path or "\0" in clean_path or clean_path.startswith("/.git") or clean_path.startswith("/uploads"):
            self._send_safe_error(404, "Доступ запрещен")
            return

        # Главная страница
        if clean_path in ("/", "/index.html"):
            self._serve_file(os.path.join(BASE_DIR, "index.html"), "text/html; charset=utf-8")

        # Стили
        elif clean_path == "/style.css":
            self._serve_file(os.path.join(BASE_DIR, "style.css"), "text/css; charset=utf-8")

        # Скрипт
        elif clean_path == "/app.js":
            self._serve_file(os.path.join(BASE_DIR, "app.js"), "application/javascript; charset=utf-8")

        # Скачивание файла задания из папки /tasks/
        elif clean_path.startswith("/tasks/"):
            rel_name = clean_path[len("/tasks/"):].lstrip("/")
            target_path = os.path.normpath(os.path.join(TASKS_DIR, rel_name))
            try:
                if os.path.commonpath([target_path, TASKS_DIR]) == TASKS_DIR and os.path.isfile(target_path):
                    self._serve_file(target_path, "application/pdf", as_attachment=True, download_name="zadanie_current.pdf")
                else:
                    self._send_safe_error(404, "Файл задания не найден")
            except Exception:
                self._send_safe_error(404, "Файл задания не найден")

        # Скачивание журнала в формате CSV
        elif clean_path in ("/submissions_log.csv", "/api/download-log"):
            self._serve_file(LOG_CSV_PATH, "text/csv; charset=utf-8", as_attachment=True, download_name="submissions_log.csv")

        # API: Список сданных работ для монитора старосты и преподавателя
        elif clean_path == "/api/submissions":
            submissions = []
            if os.path.exists(LOG_CSV_PATH):
                try:
                    with open(LOG_CSV_PATH, "r", encoding="utf-8-sig") as f:
                        reader = csv.reader(f)
                        header = next(reader, None)
                        for row in reader:
                            if len(row) >= 5:
                                student_display = row[1].lstrip("'")
                                submissions.append({
                                    "datetime": row[0],
                                    "student": student_display,
                                    "task": row[2],
                                    "filename": row[3],
                                    "size_kb": row[4]
                                })
                except Exception:
                    pass
            self._send_json(200, {"status": "ok", "submissions": list(reversed(submissions))[:50]})

        # API: Статистика группы (TASK-9 из спринта)
        elif clean_path == "/api/stats":
            total_submissions = 0
            submitted_students = set()
            tasks_count = defaultdict(int)

            if os.path.exists(LOG_CSV_PATH):
                try:
                    with open(LOG_CSV_PATH, "r", encoding="utf-8-sig") as f:
                        reader = csv.reader(f)
                        header = next(reader, None)
                        for row in reader:
                            if len(row) >= 5:
                                total_submissions += 1
                                student_clean = row[1].lstrip("'").strip()
                                submitted_students.add(student_clean)
                                tasks_count[row[2]] += 1
                except Exception:
                    pass

            group_size = len(STUDENTS_1RUP8)
            unique_count = len(submitted_students)
            percent = round((unique_count / group_size) * 100) if group_size else 0

            self._send_json(200, {
                "status": "ok",
                "total_submissions": total_submissions,
                "unique_students": unique_count,
                "group_size": group_size,
                "percent": percent,
                "group_name": "1РУП8",
                "breakdown": dict(tasks_count)
            })

        else:
            self._send_safe_error(404, "Страница не найдена")

    def do_POST(self):
        client_ip = self.client_address[0]
        if not check_rate_limit(client_ip):
            self._send_json(429, {"status": "error", "message": "Слишком много запросов. Подождите минуту."})
            return

        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/upload":
            content_type = self.headers.get("Content-Type", "")
            if not content_type.startswith("multipart/form-data"):
                self._send_json(400, {"status": "error", "message": "Ожидается multipart/form-data"})
                return

            boundary_match = re.search(r"boundary=([^;]+)", content_type)
            if not boundary_match:
                self._send_json(400, {"status": "error", "message": "Не найден boundary в заголовках"})
                return

            boundary = boundary_match.group(1).strip('"\'')

            try:
                content_len = int(self.headers.get("Content-Length", 0))
            except ValueError:
                self._send_json(400, {"status": "error", "message": "Неверный Content-Length"})
                return

            if content_len <= 0:
                self._send_json(400, {"status": "error", "message": "Файл не содержит данных"})
                return

            # Strix Vector 6: Защита памяти от переполнения (DoS)
            if content_len > MAX_FILE_SIZE:
                self._send_json(400, {"status": "error", "message": "Размер файла превышает 50 МБ"})
                return

            body = self.rfile.read(content_len)
            fields, files = parse_multipart_data(body, boundary)

            # Strix Vector 7: Honeypot Anti-Spam защита
            honeypot_val = fields.get("middle_name_check", "").strip()
            if honeypot_val:
                self._send_json(400, {"status": "error", "message": "Подозрительная активность (Honeypot Triggered)"})
                return

            student_raw = fields.get("student", "").strip()
            task_raw = fields.get("task", "").strip()
            file_item = files.get("file")

            if not student_raw:
                self._send_json(400, {"status": "error", "message": "Выберите студента из списка группы"})
                return

            if not task_raw:
                self._send_json(400, {"status": "error", "message": "Выберите номер практической работы"})
                return

            if not file_item or not file_item.get("content"):
                self._send_json(400, {"status": "error", "message": "Файл не содержит данных"})
                return

            original_filename = file_item.get("filename", "")
            file_bytes = file_item.get("content", b"")

            if len(file_bytes) == 0:
                self._send_json(400, {"status": "error", "message": "Файл не содержит данных"})
                return

            # Strix Vector 2: Глубокая проверка расширения файла
            clean_original_fn = os.path.basename(original_filename.strip().lower())
            
            for bad_ext in DANGEROUS_EXTENSIONS:
                if clean_original_fn.endswith(bad_ext):
                    self._send_json(400, {
                        "status": "error",
                        "message": f"Файлы формата {bad_ext} строго запрещены политикой безопасности колледжа."
                    })
                    return

            _, raw_ext = os.path.splitext(clean_original_fn)
            ext = raw_ext.lower()

            if ext not in ALLOWED_EXTENSIONS:
                self._send_json(400, {
                    "status": "error",
                    "message": f"Формат {ext or 'без расширения'} недопустим. "
                               f"Разрешены: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
                })
                return

            # Санитизация имени студента
            student_clean = sanitize_text_input(student_raw, max_len=60)
            surname = student_clean.split()[0] if student_clean else "Студент"

            # Определение номера работы
            task_num_match = re.search(r"\d+", task_raw)
            task_num = task_num_match.group(0) if task_num_match else "1"

            # Формирование уникального имени по стандарту колледжа
            saved_filename = generate_unique_filename(surname, task_num, ext)
            dest_path = os.path.join(UPLOADS_DIR, saved_filename)

            # Сохранение на диск
            with open(dest_path, "wb") as f:
                f.write(file_bytes)

            size_kb = round(len(file_bytes) / 1024, 1)
            now = datetime.datetime.now()
            dt_str = now.strftime("%d.%m.%Y %H:%M:%S")
            time_short = now.strftime("%H:%M")

            # Strix Vector 3: Защита CSV от формульных инъекций
            safe_dt = sanitize_csv_field(dt_str)
            safe_student = sanitize_csv_field(student_clean)
            safe_task = sanitize_csv_field(f"Работа №{task_num}")
            safe_saved_fn = sanitize_csv_field(saved_filename)
            safe_size = sanitize_csv_field(f"{size_kb} КБ")

            with open(LOG_CSV_PATH, "a", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([safe_dt, safe_student, safe_task, safe_saved_fn, safe_size])

            self._send_json(200, {
                "status": "ok",
                "time": time_short,
                "timestamp": dt_str,
                "filename": saved_filename,
                "student": student_clean,
                "task": f"Практическая работа №{task_num}",
                "size_kb": size_kb
            })
        else:
            self._send_safe_error(404, "Endpoint не найден")


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"[!] Некорректный порт: {sys.argv[1]}, используется {DEFAULT_PORT}")

    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, LabDropHandler)

    local_ips = get_local_ips()

    print("\n" + "=" * 68)
    print("  [+] LabDrop | 1РУП8 — Премиальный веб-сервис приема практических работ")
    print("  Strix SecOps Certified • Защита от XSS, DDE, DoS, Path Traversal")
    print("  Разработчики: Савченков Артем и Алиев Марат (группа 1РУП8)")
    print("=" * 68)
    print(f"  -> Локально на этом ПК:   http://localhost:{port}")
    for ip in local_ips:
        print(f"  -> Студентам в кабинете:  http://{ip}:{port}")
    print("-" * 68)
    print(f"  [DIR] Каталог работ:      {UPLOADS_DIR}")
    print(f"  [PDF] Задание к уроку:    {os.path.join(TASKS_DIR, 'zadanie_current.pdf')}")
    print(f"  [CSV] Журнал сдачи:       {LOG_CSV_PATH}")
    print("=" * 68)
    print("  Сервер слушает входящие подключения. Нажмите Ctrl+C для выхода.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Сервер LabDrop остановлен.")
        httpd.server_close()


if __name__ == "__main__":
    main()
