#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LabDrop | 1РУП8 — Локальный веб-сервер быстрой сдачи практических работ.
Разработчики: Савченков Артем и Алиев Марат (группа 1РУП8)

Запуск:
    python server.py
    (или python server.py 8080 для выбора порта)
"""

import os
import sys
import re
import csv
import json
import socket
import datetime
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

# Настройка безопасной кодировки вывода для консоли Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Базовые настройки
DEFAULT_PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TASKS_DIR = os.path.join(BASE_DIR, "tasks")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
LOG_CSV_PATH = os.path.join(BASE_DIR, "submissions_log.csv")

# Допустимые расширения файлов
ALLOWED_EXTENSIONS = {".docx", ".doc", ".pdf", ".py", ".zip", ".rar", ".txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Убеждаемся в наличии рабочих каталогов
os.makedirs(TASKS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Инициализация CSV журнала с UTF-8 BOM для корректного открытия в Excel
if not os.path.exists(LOG_CSV_PATH):
    with open(LOG_CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Дата и время", "Студент", "Номер работы", "Имя сохраненного файла", "Размер (КБ)"])


def get_local_ips():
    """Получение IP-адресов машины для вывода в консоль."""
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127."):
                ips.append(ip)
    except Exception:
        pass
    if not ips:
        # Резервный способ через сокет
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
            s.close()
        except Exception:
            ips.append("127.0.0.1")
    return ips


def parse_multipart_data(body: bytes, boundary: str):
    """
    Автономный парсер multipart/form-data без сторонних библиотек.
    Совместим со всеми версиями Python 3.8 - 3.14+ (где удален cgi.FieldStorage).
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
    Формирует имя по стандарту: 1RUP8_<Фамилия>_Работа<Номер>.<расширение>
    С защитой от затирания версий (_v2, _v3 и т.д.).
    """
    # Очистка фамилии от пробелов и спецсимволов для безопасности файловой системы
    safe_surname = re.sub(r"[^\w\-]", "", surname.strip())
    if not safe_surname:
        safe_surname = "Студент"

    clean_ext = ext.lower()
    base_name = f"1RUP8_{safe_surname}_Работа{task_num}"
    candidate = f"{base_name}{clean_ext}"
    target_path = os.path.join(UPLOADS_DIR, candidate)

    if not os.path.exists(target_path):
        return candidate

    # Если уже существует - перебираем версии v2, v3...
    version = 2
    while True:
        candidate_v = f"{base_name}_v{version}{clean_ext}"
        if not os.path.exists(os.path.join(UPLOADS_DIR, candidate_v)):
            return candidate_v
        version += 1


class LabDropHandler(BaseHTTPRequestHandler):
    """HTTP обработчик запросов LabDrop."""

    def log_message(self, format, *args):
        # Красивое логирование в консоль
        now = datetime.datetime.now().strftime("%H:%M:%S")
        sys.stderr.write(f"[{now}] {self.address_string()} - {args[0]} {args[1]}\n")

    def _send_json(self, status_code: int, data: dict):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_bytes)

    def _serve_file(self, file_path: str, content_type: str, as_attachment=False, filename=None):
        if not os.path.exists(file_path):
            self.send_error(404, "Файл не найден")
            return

        file_size = os.path.getsize(file_path)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        if as_attachment:
            safe_fn = filename or os.path.basename(file_path)
            # URL-encode для безопасной передачи кириллицы
            encoded_fn = urllib.parse.quote(safe_fn)
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{encoded_fn}")
        self.end_headers()

        with open(file_path, "rb") as f:
            while chunk := f.read(64 * 1024):
                self.wfile.write(chunk)

    def do_OPTIONS(self):
        """Поддержка CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        clean_path = parsed.path

        # Главная страница
        if clean_path in ("/", "/index.html"):
            self._serve_file(os.path.join(BASE_DIR, "index.html"), "text/html; charset=utf-8")

        # Таблица стилей
        elif clean_path == "/style.css":
            self._serve_file(os.path.join(BASE_DIR, "style.css"), "text/css; charset=utf-8")

        # Клиентский скрипт
        elif clean_path == "/app.js":
            self._serve_file(os.path.join(BASE_DIR, "app.js"), "application/javascript; charset=utf-8")

        # Скачивание файла задания
        elif clean_path.startswith("/tasks/"):
            rel_path = clean_path[len("/tasks/"):]
            safe_path = os.path.normpath(os.path.join(TASKS_DIR, rel_path))
            if safe_path.startswith(TASKS_DIR) and os.path.exists(safe_path):
                self._serve_file(safe_path, "application/pdf", as_attachment=True, filename="zadanie_current.pdf")
            else:
                self.send_error(404, "Задание не найдено")

        # Выгрузка CSV журнала для преподавателя
        elif clean_path in ("/submissions_log.csv", "/api/download-log"):
            self._serve_file(LOG_CSV_PATH, "text/csv; charset=utf-8", as_attachment=True, filename="submissions_log.csv")

        # API: Список последних сданных работ
        elif clean_path == "/api/submissions":
            submissions = []
            if os.path.exists(LOG_CSV_PATH):
                try:
                    with open(LOG_CSV_PATH, "r", encoding="utf-8-sig") as f:
                        reader = csv.reader(f)
                        header = next(reader, None)
                        for row in reader:
                            if len(row) >= 5:
                                submissions.append({
                                    "datetime": row[0],
                                    "student": row[1],
                                    "task": row[2],
                                    "filename": row[3],
                                    "size_kb": row[4]
                                })
                except Exception as e:
                    pass
            # Отдаем последние 30 сданных работ (сверху свежие)
            self._send_json(200, {"status": "ok", "submissions": list(reversed(submissions))[:30]})

        else:
            self.send_error(404, "Страница не найдена")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/upload":
            content_type = self.headers.get("Content-Type", "")
            if not content_type.startswith("multipart/form-data"):
                self._send_json(400, {"status": "error", "message": "Ожидается multipart/form-data"})
                return

            # Извлечение boundary
            boundary_match = re.search(r"boundary=([^;]+)", content_type)
            if not boundary_match:
                self._send_json(400, {"status": "error", "message": "Не найден boundary в заголовках"})
                return

            boundary = boundary_match.group(1).strip('"\'')

            # Чтение тела запроса
            try:
                content_len = int(self.headers.get("Content-Length", 0))
            except ValueError:
                self._send_json(400, {"status": "error", "message": "Неверный Content-Length"})
                return

            if content_len <= 0:
                self._send_json(400, {"status": "error", "message": "Файл не содержит данных"})
                return

            if content_len > MAX_FILE_SIZE:
                self._send_json(400, {"status": "error", "message": "Размер файла превышает 50 МБ"})
                return

            body = self.rfile.read(content_len)

            # Парсинг полей
            fields, files = parse_multipart_data(body, boundary)

            student_name = fields.get("student", "").strip()
            task_raw = fields.get("task", "").strip()
            file_item = files.get("file")

            if not student_name:
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

            # Проверка расширения
            _, raw_ext = os.path.splitext(original_filename)
            ext = raw_ext.lower()

            if ext not in ALLOWED_EXTENSIONS:
                self._send_json(400, {
                    "status": "error",
                    "message": f"Файлы формата {ext or 'без расширения'} запрещены. "
                               f"Разрешены только: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
                })
                return

            # Выделение фамилии и номера работы
            # "Алиев Марат" -> "Алиев"
            surname = student_name.split()[0]
            # Поиск номера: "Практическая работа №3" -> "3", или "3" -> "3"
            task_num_match = re.search(r"\d+", task_raw)
            task_num = task_num_match.group(0) if task_num_match else "1"

            # Формирование имени файла
            saved_filename = generate_unique_filename(surname, task_num, ext)
            dest_path = os.path.join(UPLOADS_DIR, saved_filename)

            # Сохранение файла на диск
            with open(dest_path, "wb") as f:
                f.write(file_bytes)

            # Расчет размера
            size_kb = round(len(file_bytes) / 1024, 1)
            now = datetime.datetime.now()
            dt_str = now.strftime("%d.%m.%Y %H:%M:%S")
            time_short = now.strftime("%H:%M")

            # Запись в CSV журнал
            with open(LOG_CSV_PATH, "a", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([dt_str, student_name, f"Работа №{task_num}", saved_filename, f"{size_kb} КБ"])

            # Ответ клиенту
            self._send_json(200, {
                "status": "ok",
                "time": time_short,
                "timestamp": dt_str,
                "filename": saved_filename,
                "student": student_name,
                "task": f"Практическая работа №{task_num}",
                "size_kb": size_kb
            })
        else:
            self.send_error(404, "Endpoint не найден")


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

    print("\n" + "=" * 64)
    print("  [+] LabDrop | 1РУП8 — Сервер сдачи практических работ")
    print("  Компьютерный кабинет колледжа • Без ввода паролей и Google")
    print("  Разработчики: Савченков Артем и Алиев Марат (1РУП8)")
    print("=" * 64)
    print(f"  -> Локально на этом ПК:   http://localhost:{port}")
    for ip in local_ips:
        print(f"  -> Студентам в кабинете:  http://{ip}:{port}")
    print("-" * 64)
    print(f"  [DIR] Каталог работ:      {UPLOADS_DIR}")
    print(f"  [PDF] Задание к уроку:    {os.path.join(TASKS_DIR, 'zadanie_current.pdf')}")
    print(f"  [CSV] Журнал сдачи:       {LOG_CSV_PATH}")
    print("=" * 64)
    print("  Сервер слушает входящие подключения. Нажмите Ctrl+C для выхода.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Сервер LabDrop остановлен.")
        httpd.server_close()


if __name__ == "__main__":
    main()
