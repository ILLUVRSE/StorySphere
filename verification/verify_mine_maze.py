from playwright.sync_api import sync_playwright

def verify_mine_maze():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game
        page.goto("http://localhost:8080/frontend/public/games/mine-maze/index.html")

        # Wait for canvas
        page.wait_for_selector("#gameCanvas")

        # Take initial screenshot
        page.screenshot(path="verification/mine_maze_initial.png")
        print("Initial screenshot taken.")

        # Click the center tile (approximate coordinates)
        # Canvas is centered. Logic size ~8*64 = 512 + padding.
        # We can click element.
        canvas = page.locator("#gameCanvas")
        box = canvas.bounding_box()

        # Click safely in middle (row 4, col 4)
        click_x = box['x'] + box['width'] / 2
        click_y = box['y'] + box['height'] / 2 + 30 # Offset by HUD

        page.mouse.click(click_x, click_y)

        # Wait a bit for potential animations/render
        page.wait_for_timeout(500)

        # Take revealed screenshot
        page.screenshot(path="verification/mine_maze_revealed.png")
        print("Revealed screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_mine_maze()
