from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('http://localhost:8080')
    
    val1 = page.evaluate('getComputedStyle(document.body).getPropertyValue("--bg-page")')
    bg1 = page.evaluate('getComputedStyle(document.body).backgroundColor')
    color1 = page.evaluate('getComputedStyle(document.body).color')
    print('DARK: --bg-page =', val1.strip(), 'backgroundColor =', bg1, 'color =', color1)
    
    # Click toggle button
    page.locator('button[aria-label="Сменить тему"]').click()
    page.wait_for_timeout(300)
    
    val2 = page.evaluate('getComputedStyle(document.body).getPropertyValue("--bg-page")')
    bg2 = page.evaluate('getComputedStyle(document.body).backgroundColor')
    color2 = page.evaluate('getComputedStyle(document.body).color')
    print('LIGHT: --bg-page =', val2.strip(), 'backgroundColor =', bg2, 'color =', color2)
    
    browser.close()
