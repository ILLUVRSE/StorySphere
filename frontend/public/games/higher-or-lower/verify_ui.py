from playwright.sync_api import sync_playwright, expect
import time

def verify_higher_lower():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Start Screen
        page.goto("http://localhost:8000/index.html")
        time.sleep(1) # wait for fonts/styles
        page.screenshot(path="/home/jules/verification/01_start_screen.png")
        print("Captured start screen.")

        # 2. Enter Millionaire Mode
        page.click("button[data-mode='millionaire']")
        time.sleep(1)

        # Verify elements
        ladder = page.locator("#ladder-container")
        expect(ladder).to_be_visible()

        lifelines = page.locator("#millionaire-lifelines")
        expect(lifelines).to_be_visible()

        page.screenshot(path="/home/jules/verification/02_millionaire_mode.png")
        print("Captured millionaire mode.")

        # 3. Make a guess (Dramatic Reveal)
        # We need to click a button, wait for the reveal delay, and see the result
        page.click("#btn-higher")

        # Capture during reveal (dimmed)
        time.sleep(0.5)
        page.screenshot(path="/home/jules/verification/03_dramatic_reveal.png")
        print("Captured dramatic reveal.")

        # Wait for reveal to finish (2s + 0.5s + buffer)
        time.sleep(3)
        page.screenshot(path="/home/jules/verification/04_after_reveal.png")
        print("Captured after reveal.")

        browser.close()

if __name__ == "__main__":
    verify_higher_lower()
