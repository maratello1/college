#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.error

# Windows console encoding
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8089
BASE_URL = f"http://127.0.0.1:{PORT}"

def run_tests():
    print("=" * 64)
    print("  🚀 Тестирование сервиса LabDrop (Next.js + TypeScript + Tailwind)")
    print(f"  🎯 Target: {BASE_URL}")
    print("=" * 64)

    # Запускаем next start напрямую через node
    next_bin = os.path.join(BASE_DIR, "node_modules", "next", "dist", "bin", "next")
    proc = subprocess.Popen(
        ["node", next_bin, "start", "-p", str(PORT)],
        cwd=BASE_DIR
    )
    time.sleep(3)

    try:
        # 1. GET /
        print("\n[1] Проверка GET / (главная страница Next.js)...")
        with urllib.request.urlopen(f"{BASE_URL}/") as resp:
            assert resp.status == 200
            html = resp.read().decode("utf-8")
            assert "LabDrop" in html
            assert "1РУП8" in html
            print("  [OK] Главная страница отдает HTTP 200")

        # 2. GET /tasks/zadanie_current.pdf
        print("\n[2] Проверка скачивания задания /tasks/zadanie_current.pdf...")
        with urllib.request.urlopen(f"{BASE_URL}/tasks/zadanie_current.pdf") as resp:
            assert resp.status == 200
            data = resp.read()
            assert data.startswith(b"%PDF-")
            print("  [OK] PDF задания успешно отдается")

        # Helper upload
        def send_upload(fields: dict, filename: str, content: bytes, boundary="----TestBoundaryNextXYZ"):
            body = b""
            for k, v in fields.items():
                body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8")
            if filename is not None:
                body += (
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                    f"Content-Type: application/octet-stream\r\n\r\n"
                ).encode("utf-8") + content + b"\r\n"
            body += f"--{boundary}--\r\n".encode("utf-8")

            req = urllib.request.Request(
                f"{BASE_URL}/api/upload",
                data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    return resp.status, json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                try:
                    data = json.loads(e.read().decode("utf-8"))
                except Exception:
                    data = {"message": str(e)}
                return e.code, data

        # 3. Пустой файл
        print("\n[3] Проверка блокировки пустого файла (0 байт)...")
        st, res = send_upload({"student": "Алиев Марат", "task": "1"}, "empty.docx", b"")
        assert st == 400
        assert "не содержит данных" in res.get("message", "")
        print("  [OK] Пустой файл успешно заблокирован с правильным сообщением")

        # 4. Запрещенный формат .exe
        print("\n[4] Проверка блокировки .exe...")
        st, res = send_upload({"student": "Алиев Марат", "task": "1"}, "virus.exe", b"MZ_EXEC")
        assert st == 400
        assert "запрещены" in res.get("message", "")
        print("  [OK] .exe файл успешно заблокирован")

        # 5. Успешная сдача для Алиева Марата
        print("\n[5] Проверка сдачи работы (Алиев Марат, Работа №1)...")
        st, res = send_upload({"student": "Алиев Марат", "task": "1"}, "report.docx", b"TEST_REPORT_DOCX")
        assert st == 200
        assert res.get("status") == "ok"
        fn1 = res.get("filename")
        print(f"  [OK] Работа принята, сохранена как: {fn1}")

        # 6. Повторная сдача (защита от перезаписи _v2)
        print("\n[6] Проверка защиты от перезаписи (версионирование _v2)...")
        st, res2 = send_upload({"student": "Алиев Марат", "task": "1"}, "report2.docx", b"TEST_REPORT_DOCX_V2")
        assert st == 200
        fn2 = res2.get("filename")
        assert fn1 != fn2
        assert "_v" in fn2
        print(f"  [OK] Повторная сдача не затерла файл, имя: {fn2}")

        # 7. GET /api/submissions
        print("\n[7] Проверка GET /api/submissions...")
        with urllib.request.urlopen(f"{BASE_URL}/api/submissions") as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert data.get("status") == "ok"
            assert len(data.get("submissions", [])) >= 2
            print(f"  [OK] Журнал вернул {len(data['submissions'])} записей")

        # 8. GET /api/stats
        print("\n[8] Проверка GET /api/stats...")
        with urllib.request.urlopen(f"{BASE_URL}/api/stats") as resp:
            assert resp.status == 200
            stats = json.loads(resp.read().decode("utf-8"))
            assert stats.get("status") == "ok"
            assert stats.get("total_submissions") >= 2
            print(f"  [OK] Статистика группы: {stats['unique_students']} из {stats['group_size']} ({stats['percent']}%)")

        # 9. GET /api/download-log
        print("\n[9] Проверка выгрузки журнала /api/download-log...")
        with urllib.request.urlopen(f"{BASE_URL}/api/download-log") as resp:
            assert resp.status == 200
            assert "text/csv" in resp.headers.get("Content-Type", "")
            print("  [OK] CSV журнал скачивается с правильными заголовками")

        print("\n" + "=" * 64)
        print("  🎉 ВСЕ 9 ТЕСТОВ NEXT.JS УСПЕШНО ПРОЙДЕНЫ (100% PASS)!")
        print("=" * 64)
        return True
    finally:
        subprocess.call(f"taskkill /F /T /PID {proc.pid}", shell=True)

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
