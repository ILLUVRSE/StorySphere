from playwright.sync_api import sync_playwright

def verify_game():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game
        url = "http://localhost:8080/games/indian-poker/index.html"
        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for canvas
        page.wait_for_selector("#gameCanvas")

        # Wait a bit for the deal animation/logic to start
        page.wait_for_timeout(2000)

        # Take screenshot of initial state (should see cards dealt)
        page.screenshot(path="verification/indian_poker_initial.png")
        print("Initial screenshot taken.")

        # Check if buttons are present
        # Note: Buttons might be disabled if it's not player's turn,
        # but in initial round with Dealer 0 (Hero), Hero acts first?
        # Wait, Dealer is 0. TurnIdx starts at Dealer+1 = 1 (Bot-L).
        # So it might be bot's turn.
        # Let's wait longer for bots to act.

        print("Waiting for bots to act...")
        page.wait_for_timeout(5000)

        # Now it might be Hero's turn (TurnIdx 0)
        page.screenshot(path="verification/indian_poker_mid_round.png")
        print("Mid-round screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_game()
