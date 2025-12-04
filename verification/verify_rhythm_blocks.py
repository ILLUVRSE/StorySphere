from playwright.sync_api import sync_playwright, expect
import time

def verify_rhythm_blocks(page):
    # Go to the game
    print("Navigating to Rhythm Blocks...")
    page.goto("http://localhost:8000/games/rhythm-blocks/index.html")

    # Check for title
    expect(page.get_by_role("heading", name="Rhythm Blocks")).to_be_visible()
    print("Title visible.")

    # Check for Start button
    start_btn = page.locator("#start-btn")
    expect(start_btn).to_be_visible()
    print("Start button visible.")

    # Screenshot initial state
    page.screenshot(path="verification/rhythm-blocks-start.png")
    print("Screenshot 1 taken.")

    # Click start
    start_btn.click()

    # Wait for game to start and draw something
    time.sleep(1)

    # Screenshot gameplay
    page.screenshot(path="verification/rhythm-blocks-gameplay.png")
    print("Screenshot 2 taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_rhythm_blocks(page)
        finally:
            browser.close()
