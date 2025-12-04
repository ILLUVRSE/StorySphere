from playwright.sync_api import sync_playwright

def verify_blackjack():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to ensure consistent layout
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        try:
            # Navigate to the served game
            page.goto("http://localhost:8080/games/blackjack/index.html")

            # Wait for canvas to be present
            page.wait_for_selector("#gameCanvas")

            # Allow some time for init
            page.wait_for_timeout(1000)

            # Take screenshot of betting state
            page.screenshot(path="verification/blackjack_betting.png")
            print("Screenshot betting state saved.")

            # Simulate click on "BET 10" button
            # Button is visually at 400, 560 relative to canvas (800x600).
            # We use element-relative click to be robust against layout centering.
            page.click("#gameCanvas", position={'x': 400, 'y': 560})
            print("Clicked Place Bet button.")

            # Wait for deal animation (cards dealt, state changes to PLAYER_TURN)
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
