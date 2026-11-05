import os
import sys
import time
import json
import urllib.request
import urllib.error
import subprocess

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_SCRIPT = os.path.join(BASE_DIR, "server.py")
TEST_PORT = 8999
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

def run_tests():
    print("--- Starting LabDrop Server Automated Tests ---")
    
    # 1. Start server in a background subprocess
    proc = subprocess.Popen([sys.executable, SERVER_SCRIPT, str(TEST_PORT)], cwd=BASE_DIR)
    time.sleep(1.5)
    
    try:
        # Test 1: GET /
        print("[1] Testing GET / (index.html)...")
        with urllib.request.urlopen(f"{BASE_URL}/") as resp:
            assert resp.status == 200
            html = resp.read().decode("utf-8")
            assert "LabDrop" in html
            assert "1РУП8" in html
            assert "Алиев Марат" in html
            assert "Савченков Артем" in html
            assert "zadanie_current.pdf" in html
            print("  [OK] GET / passed")

        # Test 2: GET /style.css
        print("[2] Testing GET /style.css...")
        with urllib.request.urlopen(f"{BASE_URL}/style.css") as resp:
            assert resp.status == 200
            css = resp.read().decode("utf-8")
            assert ":root" in css
            assert "--primary" in css
            print("  [OK] GET /style.css passed")

        # Test 3: GET /app.js
        print("[3] Testing GET /app.js...")
        with urllib.request.urlopen(f"{BASE_URL}/app.js") as resp:
            assert resp.status == 200
            js = resp.read().decode("utf-8")
            assert "validateFile" in js
            assert "Файл не содержит данных" in js
            print("  [OK] GET /app.js passed")

        # Test 4: GET /tasks/zadanie_current.pdf
        print("[4] Testing GET /tasks/zadanie_current.pdf...")
        with urllib.request.urlopen(f"{BASE_URL}/tasks/zadanie_current.pdf") as resp:
            assert resp.status == 200
            pdf_bytes = resp.read()
            assert pdf_bytes.startswith(b"%PDF-")
            print("  [OK] GET /tasks/zadanie_current.pdf passed")

        # Helper to send multipart POST
        def send_upload(student, task, filename, file_content):
            boundary = "----TestBoundaryXYZ789"
            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="student"\r\n\r\n'
                f"{student}\r\n"
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="task"\r\n\r\n'
                f"{task}\r\n"
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                f"Content-Type: application/octet-stream\r\n\r\n"
            ).encode("utf-8") + file_content + f"\r\n--{boundary}--\r\n".encode("utf-8")

            req = urllib.request.Request(
                f"{BASE_URL}/upload",
                data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    return resp.status, json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read().decode("utf-8"))

        # Test 5: Empty file error
        print("[5] Testing empty file upload rejection...")
        status, res = send_upload("Алиев Марат", "1", "empty.docx", b"")
        assert status == 400
        assert "Файл не содержит данных" in res["message"]
        print("  [OK] Empty file rejected correctly")

        # Test 6: Forbidden extension (.exe)
        print("[6] Testing forbidden extension .exe rejection...")
        status, res = send_upload("Алиев Марат", "1", "virus.exe", b"MZ_EXECUTABLE_CONTENT")
        assert status == 400
        assert "запрещены" in res["message"]
        print("  [OK] Forbidden file format rejected correctly")

        # Test 7: Valid file upload 1
        print("[7] Testing valid file upload for Алиев Марат...")
        status, res = send_upload("Алиев Марат", "1", "lab_report.docx", b"DOCX_DATA_CONTENT_HERE")
        assert status == 200
        assert res["status"] == "ok"
        assert res["filename"] == "1RUP8_Алиев_Работа1.docx"
        assert os.path.exists(os.path.join(BASE_DIR, "uploads", "1RUP8_Алиев_Работа1.docx"))
        print(f"  [OK] Valid upload saved as: {res['filename']}")

        # Test 8: Overwrite protection (versioning _v2)
        print("[8] Testing overwrite protection (version _v2)...")
        status, res2 = send_upload("Алиев Марат", "1", "lab_report_v2.docx", b"NEW_DOCX_DATA_CONTENT")
        assert status == 200
        assert res2["status"] == "ok"
        assert res2["filename"] == "1RUP8_Алиев_Работа1_v2.docx"
        assert os.path.exists(os.path.join(BASE_DIR, "uploads", "1RUP8_Алиев_Работа1_v2.docx"))
        print(f"  [OK] Overwrite prevented, saved as: {res2['filename']}")

        # Test 9: Valid upload for second author Савченков Артем
        print("[9] Testing valid file upload for Савченков Артем...")
        status, res3 = send_upload("Савченков Артем", "2", "script.py", b"print('Hello from 1RUP8')")
        assert status == 200
        assert res3["filename"] == "1RUP8_Савченков_Работа2.py"
        assert os.path.exists(os.path.join(BASE_DIR, "uploads", "1RUP8_Савченков_Работа2.py"))
        print(f"  [OK] Valid upload saved as: {res3['filename']}")

        # Test 10: Check submissions_log.csv
        print("[10] Testing submissions_log.csv content...")
        log_path = os.path.join(BASE_DIR, "submissions_log.csv")
        assert os.path.exists(log_path)
        with open(log_path, "r", encoding="utf-8-sig") as f:
            log_content = f.read()
            assert "1RUP8_Алиев_Работа1.docx" in log_content
            assert "1RUP8_Алиев_Работа1_v2.docx" in log_content
            assert "1RUP8_Савченков_Работа2.py" in log_content
        print("  [OK] submissions_log.csv contains all logged submissions")

        # Test 11: GET /api/submissions
        print("[11] Testing GET /api/submissions...")
        with urllib.request.urlopen(f"{BASE_URL}/api/submissions") as resp:
            assert resp.status == 200
            sub_data = json.loads(resp.read().decode("utf-8"))
            assert sub_data["status"] == "ok"
            assert len(sub_data["submissions"]) >= 3
        print(f"  [OK] GET /api/submissions returned {len(sub_data['submissions'])} items")

        print("\n==========================================")
        print("[SUCCESS] ALL 11 TESTS PASSED WITH 100% SUCCESS!")
        print("==========================================")

    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_tests()
