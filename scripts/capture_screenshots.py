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
    context = browser.new_context(viewport={'width': 1440, 'height': 960})
    page = context.new_page()
    page.goto('http://localhost:8080', wait_until='networkidle')
    time.sleep(1)
    save_both(page, '01_desktop_dark.png')
    
    # 2. Desktop Light Theme (click theme toggle)
    # The theme toggle button has title="Переключить тему оформления" or aria-label="Сменить тему"
    toggle_btn = page.locator('button[aria-label="Сменить тему"]')
    if toggle_btn.count() > 0:
        toggle_btn.click()
        time.sleep(0.5)
        save_both(page, '02_desktop_light.png')
        # switch back to dark
        toggle_btn.click()
        time.sleep(0.5)

    # 3. Live Dashboard / Monitor
    # Scroll down to the dashboard section
    page.evaluate("window.scrollTo(0, 1000)")
    time.sleep(0.5)
    save_both(page, '03_teacher_monitor.png')
    
    # 4. Successful Submission Receipt
    # Scroll back to top
    page.evaluate("window.scrollTo(0, 0)")
    time.sleep(0.5)
    
    # Select student (first option is Алиев Марат)
    select_student = page.locator('select').first
    select_student.select_option(label='Алиев Марат')
    
    # Select lab number (second select)
    select_lab = page.locator('select').nth(1)
    select_lab.select_option(value='3')
    
    # Set file input
    # Create a small temp docx or test file
    test_file_path = r'd:\Desktop\kavkazskitur\labdrop-1rup8\temp_test_screenshot.docx'
    with open(test_file_path, 'wb') as f:
        f.write(b"PK\x03\x04Demo LabDrop file content for screenshot")
        
    file_input = page.locator('input[type="file"]')
    file_input.set_input_files(test_file_path)
    time.sleep(0.5)
    
    # Click Submit button
    submit_btn = page.locator('button:has-text("Сдать работу")')
    submit_btn.click()
    time.sleep(1.5)
    
    save_both(page, '04_submission_receipt.png')
    
    # Cleanup temp file
    if os.path.exists(test_file_path):
        os.remove(test_file_path)

    # 5. Mobile Viewport (iPhone 14 / standard mobile 390x844)
    mobile_context = browser.new_context(
        viewport={'width': 390, 'height': 844},
        user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    )
    m_page = mobile_context.new_page()
    m_page.goto('http://localhost:8080', wait_until='networkidle')
    time.sleep(1)
    save_both(m_page, '05_mobile_layout.png')
    
    browser.close()
    print("All screenshots generated successfully!")
