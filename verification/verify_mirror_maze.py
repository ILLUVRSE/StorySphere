from playwright.sync_api import sync_playwright

def verify_game():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to the game
        page.goto("http://localhost:8080/games/mirror-maze/index.html?seed=test")

        # Wait for canvas
        page.wait_for_selector("#gameCanvas")

        # Take initial screenshot
        page.screenshot(path="verification/mirror_maze_initial.png")

        # Simulate a click on the grid (approx middle)
        # 8x8 grid. Click at 200, 200 (approx tile 3,3 if size matches)
        # We need to wait a bit for init
        page.wait_for_timeout(1000)

        page.mouse.click(200, 200)
        page.wait_for_timeout(500)

        # Screenshot after interaction
        page.screenshot(path="verification/mirror_maze_interact.png")

        browser.close()

if __name__ == "__main__":
    verify_game()
