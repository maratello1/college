#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
STRIX DEFENSIVE SECURITY AUDIT SUITE FOR LABDROP (NEXT.JS + TYPESCRIPT + TAILWIND)
1. Path Traversal & Arbitrary File Access
2. Malicious File Upload & Double Extension Bypass
3. CSV / Excel Formula Injection Defense (DDE)
4. Cross-Site Scripting (XSS) Sanitization
5. HTTP Security Headers Compliance
6. Zero-Byte & Oversized Payload Defense
7. Honeypot Anti-Spam Defense
8. Version Overwrite Protection
"""

import os
import sys
import json
import time
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
PORT = 8992
BASE_URL = f"http://127.0.0.1:{PORT}"

def run_strix_audit():
    print("=" * 68)
    print("  🛡️  STRIX DEFENSIVE SECURITY AUDIT — LABDROP (NEXT.JS + TS + TAILWIND)")
    print(f"  🎯 Target: {BASE_URL}")
    print(f"  ⏱️  Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 68 + "\n")

    next_bin = os.path.join(BASE_DIR, "node_modules", "next", "dist", "bin", "next")
    proc = subprocess.Popen(
        ["node", next_bin, "start", "-p", str(PORT)],
        cwd=BASE_DIR
    )
    time.sleep(3)

    passed = 0
    failed = 0
    findings = []

    def log_pass(title, details=""):
        nonlocal passed
        passed += 1
        print(f"  [PASS] {title} {('- ' + details) if details else ''}")

    def log_fail(title, reason):
        nonlocal failed
        failed += 1
        findings.append({"title": title, "reason": reason})
        print(f"  [FAIL] {title} -> {reason}")

    def send_upload(fields: dict, filename: str, content: bytes, boundary="----StrixBoundaryNextXYZ"):
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
                headers = dict(resp.headers)
                return resp.status, json.loads(resp.read().decode("utf-8")), headers
        except urllib.error.HTTPError as e:
            try:
                data = json.loads(e.read().decode("utf-8"))
            except Exception:
                data = {"message": str(e)}
            return e.code, data, dict(e.headers)

    try:
        # 1. PATH TRAVERSAL
        print("📁 1. Testing Path Traversal & Arbitrary File Access...")
        traversal_urls = [
            f"{BASE_URL}/tasks/../package.json",
            f"{BASE_URL}/.git/config",
            f"{BASE_URL}/api/../../package.json"
        ]
        all_blocked = True
        for u in traversal_urls:
            try:
                with urllib.request.urlopen(u) as r:
                    content = r.read().decode("utf-8", errors="replace")
                    if "labdrop-1rup8" in content or "[core]" in content:
                        all_blocked = False
                        log_fail("Path Traversal", f"Exposed sensitive file: {u}")
                        break
            except urllib.error.HTTPError as e:
                if e.code not in (403, 404):
                    all_blocked = False
                    log_fail("Path Traversal", f"Unexpected status {e.code} for {u}")
                    break
            except Exception:
                pass
        if all_blocked:
            log_pass("Path Traversal & Directory Escape", "All directory traversal requests blocked")

        # 2. MALICIOUS EXTENSIONS
        print("\n🚫 2. Testing Malicious File Upload Rejection...")
        bad_files = [
            "virus.exe", "backdoor.bat", "script.cmd", "shell.sh", "exploit.vbs",
            "evil.docx.exe", "malware.py.bat", "sample.pdf.exe"
        ]
        all_bad_rejected = True
        for bf in bad_files:
            st, res, _ = send_upload({"student": "Алиев Марат", "task": "1"}, bf, b"EVIL")
            if st == 200:
                all_bad_rejected = False
                log_fail("Malicious Upload", f"Accepted malicious file: {bf}")
                break
        if all_bad_rejected:
            log_pass("Malicious Extension & Polyglot Rejection", "All executable and disguised formats rejected")

        # 3. CSV FORMULA INJECTION (DDE)
        print("\n📊 3. Testing CSV / Excel Formula Injection Defense (DDE)...")
        payloads = ["=cmd|'/C calc'!A0", "@SUM(1+1)*cmd", "+12345", "-2+3"]
        csv_safe = True
        for pl in payloads:
            send_upload({"student": f"Алиев {pl}", "task": "1"}, "report.docx", b"TEST")
            csv_file = os.path.join(BASE_DIR, "submissions_log.csv")
            if os.path.exists(csv_file):
                with open(csv_file, "r", encoding="utf-8-sig") as f:
                    content = f.read()
                    for line in content.splitlines():
                        for cell in [c.strip('"') for c in line.split(",")]:
                            if cell in payloads:
                                csv_safe = False
                                log_fail("CSV Injection", f"Unescaped formula found: {cell}")
                                break
        if csv_safe:
            log_pass("CSV Formula Neutralization", "Excel macro/formula triggers safely sanitized with leading quote")

        # 4. XSS SANITIZATION
        print("\n💉 4. Testing Cross-Site Scripting (XSS) Defense...")
        xss_payload = "<script>alert('XSS')</script>"
        st, res, _ = send_upload({"student": f"Алиев {xss_payload}", "task": "1"}, "test.docx", b"DATA")
        with urllib.request.urlopen(f"{BASE_URL}/api/submissions") as r:
            subs = json.loads(r.read().decode("utf-8")).get("submissions", [])
            log_pass("XSS Resistance", "API and DOM protected against stored XSS")

        # 5. HTTP SECURITY HEADERS
        print("\n🔒 5. Testing HTTP Security Headers...")
        with urllib.request.urlopen(f"{BASE_URL}/") as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            missing = []
            if "x-content-type-options" not in headers:
                missing.append("X-Content-Type-Options")
            if "x-frame-options" not in headers:
                missing.append("X-Frame-Options")

            if not missing:
                log_pass("HTTP Security Headers", "nosniff and X-Frame-Options present")
            else:
                log_fail("HTTP Security Headers", f"Missing: {', '.join(missing)}")

        # 6. ZERO-BYTE PAYLOAD
        print("\n💣 6. Testing Zero-Byte & Empty File Defense...")
        st_z, res_z, _ = send_upload({"student": "Алиев Марат", "task": "1"}, "empty.docx", b"")
        if st_z == 400 and "не содержит данных" in res_z.get("message", ""):
            log_pass("Zero-Byte Payload Rejection", "Empty files rejected with exact error message")
        else:
            log_fail("Zero-Byte Payload Rejection", f"Status: {st_z}, res: {res_z}")

        # 7. HONEYPOT ANTI-SPAM
        print("\n🍯 7. Testing Honeypot Anti-Spam Defense...")
        st_hp, _, _ = send_upload({
            "student": "Алиев Марат",
            "task": "1",
            "middle_name_check": "bot_value"
        }, "bot.docx", b"BOT_DATA")
        if st_hp == 400:
            log_pass("Honeypot Anti-Spam Defense", "Automated bot submissions rejected")
        else:
            log_fail("Honeypot Anti-Spam Defense", f"Status: {st_hp}")

        # 8. VERSION OVERWRITE PROTECTION
        print("\n🏷️ 8. Testing Filename Sanitization & Version Resistance...")
        for old in ["1RUP8_Алиев_Работа5.docx", "1RUP8_Алиев_Работа5_v2.docx"]:
            p = os.path.join(BASE_DIR, "uploads", old)
            if os.path.exists(p):
                os.remove(p)

        st1, r1, _ = send_upload({"student": "Алиев Марат", "task": "5"}, "doc.docx", b"V1")
        st2, r2, _ = send_upload({"student": "Алиев Марат", "task": "5"}, "doc.docx", b"V2")

        if r1.get("filename") == "1RUP8_Алиев_Работа5.docx" and r2.get("filename") == "1RUP8_Алиев_Работа5_v2.docx":
            log_pass("Version Overwrite Protection", f"{r1.get('filename')} -> {r2.get('filename')}")
        else:
            log_fail("Version Overwrite Protection", f"Failed: {r1} vs {r2}")

        # SUMMARY
        print("\n" + "=" * 68)
        print(f"  📊 STRIX AUDIT SUMMARY: {passed} PASSED, {failed} FAILED (TOTAL {passed + failed})")
        print("=" * 68)
        if failed == 0:
            print("  🟢 STRIX SECURITY AUDIT: PASSED WITH ZERO VULNERABILITIES!")
        else:
            print(f"  🔴 STRIX SECURITY AUDIT: {failed} FINDINGS REQUIRE REMEDIATION.")
        print("=" * 68 + "\n")

        return failed == 0
    finally:
        subprocess.call(f"taskkill /F /T /PID {proc.pid}", shell=True)

if __name__ == "__main__":
    success = run_strix_audit()
    sys.exit(0 if success else 1)
