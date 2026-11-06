import os
import sys
import json
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:8080"
TEACHER_PIN = "1rup8"
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
print("  🔐 ONE-TIME TOKEN & TEACHER CONTROL TEST SUITE — LABDROP")
print("====================================================================")

def post_json(endpoint, data):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        res = urllib.request.urlopen(req, timeout=5)
        return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def post_multipart(fields, files):
    boundary = "----WebKitFormBoundaryTokensTest"
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

# 1. Teacher Auth & Pin security
print("\n🔑 1. Testing Teacher Auth & Security...")
status, res = post_json("/api/tokens", {"pin": "wrong_pin", "action": "verify_pin"})
test("Reject Invalid Teacher PIN", status == 403)

status, res = post_json("/api/tokens", {"pin": TEACHER_PIN, "action": "verify_pin"})
test("Accept Valid Teacher PIN", status == 200 and res.get("status") == "ok")

# 2. Batch Generation of Tokens for Lesson
print("\n⚡ 2. Testing Lesson Token Generation...")
status, res = post_json("/api/tokens", {"pin": TEACHER_PIN, "action": "generate_all"})
session = res.get("session", {})
tokens_dict = session.get("tokens", {})
test("Generate All Tokens (15 students)", status == 200 and len(tokens_dict) == 15)

aliev_token = tokens_dict.get("Алиев Марат", {}).get("token")
test("Token format (4 digits)", aliev_token and len(aliev_token) == 4 and aliev_token.isdigit(), f"Token: {aliev_token}")

# 3. Submission validation with tokens
print("\n🛡️ 3. Testing Submission with Tokens...")
# 3.1 Missing token
status, res = post_multipart(
    {"student": "Алиев Марат", "task": "3"},
    {"file": ("lab3.docx", b"PK\x03\x04test content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
test("Reject submission with missing token", status == 400 and "одноразовый код" in res.get("message", ""))

# 3.2 Wrong token
status, res = post_multipart(
    {"student": "Алиев Марат", "task": "3", "token": "0000"},
    {"file": ("lab3.docx", b"PK\x03\x04test content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
test("Reject submission with wrong token", status == 400 and "Неверный код" in res.get("message", ""))

# 3.3 Valid token
status, res = post_multipart(
    {"student": "Алиев Марат", "task": "3", "token": aliev_token},
    {"file": ("lab3.docx", b"PK\x03\x04test content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
test("Accept submission with valid token", status == 200 and res.get("status") == "ok")

# 3.4 Token reuse rejection (one-time enforce)
status, res = post_multipart(
    {"student": "Алиев Марат", "task": "3", "token": aliev_token},
    {"file": ("lab3_v2.docx", b"PK\x03\x04test content 2", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
test("Reject reuse of spent token", status == 400 and "уже был использован" in res.get("message", ""))

# 4. Single Student Token Regeneration
print("\n🔄 4. Testing Single Student Token Regeneration...")
status, res = post_json("/api/tokens", {"pin": TEACHER_PIN, "action": "regenerate_one", "student": "Алиев Марат"})
new_session = res.get("session", {})
new_aliev_item = new_session.get("tokens", {}).get("Алиев Марат", {})
new_token = new_aliev_item.get("token")
test("Regenerate token for single student", status == 200 and new_token != aliev_token and not new_aliev_item.get("used"))

# 4.1 Resubmit with regenerated token
status, res = post_multipart(
    {"student": "Алиев Марат", "task": "3", "token": new_token},
    {"file": ("lab3_fixed.docx", b"PK\x03\x04test content fixed", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
test("Accept submission with newly regenerated token", status == 200 and res.get("status") == "ok")

# 5. Lesson Session Lock («Замок урока»)
print("\n🔒 5. Testing Lesson Session Lock...")
status, res = post_json("/api/tokens", {"pin": TEACHER_PIN, "action": "toggle_lock"})
test("Toggle Lesson Lock (Locked)", status == 200 and res.get("session", {}).get("is_locked") is True)

# Attempt submission while locked
borisov_token = new_session.get("tokens", {}).get("Борисов Дмитрий", {}).get("token")
status, res = post_multipart(
    {"student": "Борисов Дмитрий", "task": "1", "token": borisov_token},
    {"file": ("borisov.py", b"print(1)", "text/x-python")}
)
test("Block submission when session is locked", status == 400 and "завершен" in res.get("message", ""))

# Unlock session
status, res = post_json("/api/tokens", {"pin": TEACHER_PIN, "action": "toggle_lock"})
test("Toggle Lesson Lock (Unlocked)", status == 200 and res.get("session", {}).get("is_locked") is False)

# 6. Playwright UI Check for Teacher Modal
print("\n🖥️ 6. Testing Teacher Modal in Playwright...")
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(BASE_URL, wait_until="networkidle")

    # Click "Коды" button
    codes_btn = page.locator('button:has-text("Коды")')
    codes_btn.click()
    page.wait_for_timeout(300)

    # Check modal visible
    modal = page.locator('h3:has-text("Управление токенами сдачи")')
    test("Teacher Modal Opens", modal.is_visible())

    # Enter PIN
    pin_input = page.locator('input[type="password"]')
    pin_input.fill(TEACHER_PIN)
    page.locator('button:has-text("Войти")').click()
    page.wait_for_timeout(400)

    # Check panel content
    gen_btn = page.locator('button:has-text("Сгенерировать новые коды на пару")')
    test("Teacher Panel Controls Visible", gen_btn.is_visible())

    # Switch to Projector Mode
    projector_btn = page.locator('button:has-text("Проектор")')
    projector_btn.click()
    page.wait_for_timeout(300)

    # Close modal
    close_btn = page.locator('div.glass-panel button:has(svg.lucide-x)')
    close_btn.click()
    page.wait_for_timeout(200)
    test("Teacher Modal Closes", not modal.is_visible())

    browser.close()

print("\n====================================================================")
print(f"  📊 TOKEN TEST SUMMARY: {passed} PASSED, {failed} FAILED (TOTAL {passed + failed})")
if failed == 0:
    print("  🟢 100% PASS — ONE-TIME TOKEN ARCHITECTURE FULLY OPERATIONAL!")
print("====================================================================")
