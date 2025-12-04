from playwright.sync_api import sync_playwright

def verify_blackjack():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the served game
            page.goto("http://localhost:8080/games/blackjack/index.html")

            # Wait for canvas to be present
            page.wait_for_selector("#gameCanvas")

            # Allow some time for init and "Place Bet" state
            page.wait_for_timeout(1000)

            # Take screenshot of betting state
            page.screenshot(path="verification/blackjack_betting.png")
            print("Screenshot betting state saved.")

            # Simulate click on "BET 10" button
            # Button is at center - width/2, height*0.9
            # Canvas is 800x600.
            # BET button: x = 400 - 50 = 350, y = 600 * 0.9 = 540. w=100, h=40.
            # Center of button: 400, 560.
            page.mouse.click(400, 560)

            # Wait for deal animation
            page.wait_for_timeout(2000)

            # Take screenshot of dealt state
            page.screenshot(path="verification/blackjack_dealt.png")
            print("Screenshot dealt state saved.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_blackjack()
