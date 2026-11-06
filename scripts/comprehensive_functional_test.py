import os
import sys
import json
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:8080"
passed = 0
failed = 0

def test(name, condition, details=""):
    global passed, failed
    if condition:
        print(f"  [PASS] {name}")
        passed += 1
    else:
        print(f"  [FAIL] {name}: {details}")
        failed += 1

print("====================================================================")
print("  🚀 FULL FUNCTIONAL TEST SUITE — LABDROP (NEXT.JS 15 + REACT 19)")
print("====================================================================")

# 1. API & Endpoints
print("\n📡 1. Testing Endpoints & Static Assets...")
try:
    req = urllib.request.urlopen(f"{BASE_URL}/", timeout=5)
    html = req.read().decode("utf-8")
    test("GET / (Main Page)", req.status == 200 and "LabDrop" in html and "1РУП8" in html)
except Exception as e:
    test("GET / (Main Page)", False, str(e))

try:
    req = urllib.request.urlopen(f"{BASE_URL}/tasks/zadanie_current.pdf", timeout=5)
    pdf_bytes = req.read()
    test("GET /tasks/zadanie_current.pdf", req.status == 200 and pdf_bytes.startswith(b"%PDF-"), f"Size: {len(pdf_bytes)} bytes")
except Exception as e:
    test("GET /tasks/zadanie_current.pdf", False, str(e))

try:
    req = urllib.request.urlopen(f"{BASE_URL}/api/stats", timeout=5)
    data = json.loads(req.read().decode("utf-8"))
    test("GET /api/stats", req.status == 200 and data.get("status") == "ok" and "percent" in data)
except Exception as e:
    test("GET /api/stats", False, str(e))

try:
    req = urllib.request.urlopen(f"{BASE_URL}/api/submissions", timeout=5)
    data = json.loads(req.read().decode("utf-8"))
    test("GET /api/submissions", req.status == 200 and data.get("status") == "ok" and isinstance(data.get("submissions"), list))
except Exception as e:
    test("GET /api/submissions", False, str(e))

try:
    req = urllib.request.urlopen(f"{BASE_URL}/api/download-log", timeout=5)
    csv_bytes = req.read()
    test("GET /api/download-log (Excel UTF-8 BOM)", req.status == 200 and csv_bytes.startswith(b"\xef\xbb\xbf"))
except Exception as e:
    test("GET /api/download-log (Excel UTF-8 BOM)", False, str(e))

# 2. Upload API Validation & Handlers
print("\n🛡️ 2. Testing Upload API & Validations...")

def post_multipart(fields, files):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{value}\r\n".encode("utf-8"))
    for name, (filename, content, content_type) in files.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(content)
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    req = urllib.request.Request(
        f"{BASE_URL}/api/upload",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    try:
        res = urllib.request.urlopen(req, timeout=5)
        return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

# 2.1 Valid Upload
status, res = post_multipart(
    {"student": "Алиев Марат", "task": "2"},
    {"file": ("my_code.py", b"print('Hello LabDrop')", "text/x-python")}
)
test("Valid Upload (.py)", status == 200 and res.get("status") == "ok" and "1RUP8_Алиев_Работа2" in res.get("filename", ""))

# 2.2 Versioning on duplicate
status, res2 = post_multipart(
    {"student": "Алиев Марат", "task": "2"},
    {"file": ("my_code_updated.py", b"print('Updated version')", "text/x-python")}
)
test("Versioning on duplicate (anti-overwrite)", status == 200 and "_v" in res2.get("filename", ""))

# 2.3 Zero-byte file rejection
status, res_zero = post_multipart(
    {"student": "Савченков Артем", "task": "1"},
    {"file": ("empty.docx", b"", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
test("0-byte file rejection", status == 400 and "не содержит данных" in res_zero.get("message", ""))

# 2.4 Dangerous file rejection
status, res_danger = post_multipart(
    {"student": "Иванов Сергей", "task": "1"},
    {"file": ("script.bat", b"@echo off", "application/x-bat")}
)
test("Dangerous file rejection (.bat)", status == 400 and "запрещен" in res_danger.get("message", ""))

# 3. Interactive E2E in Real Browser via Playwright
print("\n🖥️ 3. Testing Interactive E2E Flow in Playwright...")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(BASE_URL, wait_until="networkidle")

    # 3.1 Verify Theme Toggle
    theme_btn = page.locator('button[aria-label="Сменить тему"]')
    theme_btn.click()
    page.wait_for_timeout(200)
    html_theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    test("Theme Toggle (Dark -> Light)", html_theme == "light")

    theme_btn.click()
    page.wait_for_timeout(200)
    html_theme2 = page.evaluate("document.documentElement.getAttribute('data-theme')")
    test("Theme Toggle (Light -> Dark)", html_theme2 == "dark")

    # 3.2 Form Submission UI
    select_student = page.locator("#studentSelect")
    select_student.select_option(label="Савченков Артем")
    
    select_task = page.locator("#taskSelect")
    select_task.select_option(value="4")

    # Temp file for upload
    temp_test = r"d:\Desktop\kavkazskitur\labdrop-1rup8\temp_test_e2e.docx"
    with open(temp_test, "wb") as f:
        f.write(b"PK\x03\x04Test E2E docx file payload")

    page.locator('input[type="file"]').set_input_files(temp_test)
    page.wait_for_timeout(300)

    # Click Submit
    submit_btn = page.locator('button:has-text("Сдать работу")')
    test("Submit button enabled", submit_btn.is_enabled())
    submit_btn.click()
    page.wait_for_timeout(1000)

    # Check Receipt Card
    receipt_heading = page.locator('h2:has-text("Работа успешно принята")')
    test("Receipt Card Displayed", receipt_heading.is_visible())

    # Check Reset Form
    reset_btn = page.locator('button:has-text("Сдать еще одну работу")')
    reset_btn.click()
    page.wait_for_timeout(300)
    test("Reset Form to initial state", page.locator("#studentSelect").is_visible())

    # Check Submissions Drawer
    toggle_list_btn = page.locator('button:has-text("Список")')
    if toggle_list_btn.count() > 0:
        toggle_list_btn.click()
        page.wait_for_timeout(300)
        table = page.locator("table")
        test("Submissions Table Expands", table.is_visible())

    browser.close()

    if os.path.exists(temp_test):
        os.remove(temp_test)

print("\n====================================================================")
print(f"  📊 TEST SUMMARY: {passed} PASSED, {failed} FAILED (TOTAL {passed + failed})")
if failed == 0:
    print("  🟢 100% PASS — ALL FUNCTIONALITY VERIFIED WITH ZERO ERRORS!")
print("====================================================================")
