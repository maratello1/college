import os
import time
from playwright.sync_api import sync_playwright

dest_dirs = [
    r'd:\Desktop\kavkazskitur\labdrop-1rup8\docs\screenshots',
    r'd:\Desktop\kavkazskitur\labdrop-1rup8\public\screenshots'
]

for d in dest_dirs:
    os.makedirs(d, exist_ok=True)

def save_both(page, filename):
    for d in dest_dirs:
        path = os.path.join(d, filename)
        page.screenshot(path=path, full_page=False)
        print(f"Saved: {path}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    
    # 1. Desktop Dark Theme
    context = browser.new_context(viewport={'width': 1280, 'height': 820})
    page = context.new_page()
    page.goto('http://localhost:8080', wait_until='networkidle')
    time.sleep(0.5)
    save_both(page, '01_desktop_dark.png')
    
    # 2. Desktop Light Theme
    toggle_btn = page.locator('button[aria-label="Сменить тему"]')
    if toggle_btn.count() > 0:
        toggle_btn.click()
        time.sleep(0.5)
        save_both(page, '02_desktop_light.png')

    # 3. Light Theme with Monitor Opened
    toggle_monitor = page.locator('button:has-text("Показать список")')
    if toggle_monitor.count() > 0:
        toggle_monitor.click()
        time.sleep(0.5)
        save_both(page, '03_teacher_monitor.png')
        
    # Switch back to dark for remaining captures
    if toggle_btn.count() > 0:
        toggle_btn.click()
        time.sleep(0.5)

    # 4. QR Modal
    qr_btn = page.locator('button[title*="QR"]').first
    if qr_btn.count() > 0:
        qr_btn.click()
        time.sleep(0.5)
        save_both(page, '08_qr_mobile_modal.png')
        close_btn = page.locator('div.glass-panel button:has(svg.lucide-x)').first
        close_btn.click()
        time.sleep(0.3)

    # 5. Teacher Modal (Login + Password)
    teacher_btn = page.locator('button:has-text("Панель"), button:has-text("Коды")').first
    if teacher_btn.count() > 0:
        teacher_btn.click()
        time.sleep(0.5)
        save_both(page, '06_teacher_modal_auth.png')
        
        # Authenticate
        login_input = page.locator('input[placeholder*="Логин"]')
        pass_input = page.locator('input[placeholder*="Пароль"]')
        if login_input.count() > 0:
            login_input.fill('teacher')
        if pass_input.count() > 0:
            pass_input.fill('1rup8')
        page.locator('button:has-text("Войти")').click()
        time.sleep(0.5)
        
        # Set 45m timer & capture panel
        timer_btn = page.locator('button:has-text("+45м")')
        if timer_btn.count() > 0:
            timer_btn.click()
            time.sleep(0.3)
            
        save_both(page, '07_teacher_panel_timer_tokens.png')
        
        # Close teacher modal
        close_btn = page.locator('div.glass-panel button:has(svg.lucide-x)').first
        close_btn.click()
        time.sleep(0.3)

    # 6. Submission Receipt
    select_student = page.locator('select').first
    select_student.select_option(label='Савченков Артем')
    
    select_lab = page.locator('select').nth(1)
    select_lab.select_option(value='2')
    
    test_file_path = r'd:\Desktop\kavkazskitur\labdrop-1rup8\solution.py'
    with open(test_file_path, 'w', encoding='utf-8') as f:
        f.write("# Практическая работа №2\n# Савченков Артем, 1РУП8\ndef fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(list(fibonacci(10)))\n")
        
    file_input = page.locator('input[type="file"]')
    file_input.set_input_files(test_file_path)
    time.sleep(0.5)
    
    # Enter token if needed
    token_input = page.locator('input[placeholder*="Код"]')
    if token_input.count() > 0 and token_input.is_visible():
        # fetch token from API
        import urllib.request, json
        req = urllib.request.Request('http://localhost:8080/api/tokens?login=teacher&password=1rup8')
        data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
        st_tok = data.get('session', {}).get('tokens', {}).get('Савченков Артем', {}).get('token', '1234')
        token_input.fill(st_tok)

    submit_btn = page.locator('button:has-text("Сдать работу")')
    if submit_btn.is_enabled():
        submit_btn.click()
        time.sleep(1)
        save_both(page, '04_submission_receipt.png')
        
        # QuickView click
        eye_btn = page.locator('button[title*="просмотр"]').first
        if eye_btn.count() > 0:
            eye_btn.click()
            time.sleep(0.5)
            save_both(page, '09_quickview_modal.png')
            close_qv = page.locator('div.glass-panel button:has(svg.lucide-x)').first
            close_qv.click()
            time.sleep(0.3)
    
    if os.path.exists(test_file_path):
        os.remove(test_file_path)

    # 7. Mobile Viewport (390x844)
    mobile_context = browser.new_context(
        viewport={'width': 390, 'height': 844},
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    )
    m_page = mobile_context.new_page()
    m_page.goto('http://localhost:8080', wait_until='networkidle')
    time.sleep(0.5)
    save_both(m_page, '05_mobile_layout.png')

    browser.close()
    print("All screenshots successfully captured!")
