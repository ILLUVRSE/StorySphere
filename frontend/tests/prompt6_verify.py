from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock Backend APIs
        # We intercept calls to avoid needing a running backend

        # 1. Mock Login/Auth (simulated by localStorage or just successful API calls)
        page.route("**/api/teams", lambda route: route.fulfill(
            status=201,
            body='{"id": "test-team-123", "name": "Test Team", "owner_id": "u1", "skill_pool": 30, "cosmetics": {}}',
            headers={"Content-Type": "application/json"}
        ))

        page.route("**/api/teams/test-team-123", lambda route: route.fulfill(
            status=200,
            body='{"id": "test-team-123", "name": "Test Team", "skill_pool": 30, "roster": []}',
            headers={"Content-Type": "application/json"}
        ))

        page.route("**/api/teams/test-team-123/players", lambda route: route.fulfill(
            status=201,
            body='{"id": "p1", "name": "New Player", "position": "P", "stats": {"power":1,"contact":1,"speed":1,"defense":1}}',
            headers={"Content-Type": "application/json"}
        ))

        page.route("**/api/teams/test-team-123/skill-allocation", lambda route: route.fulfill(
            status=200,
            body='{"success": true}',
            headers={"Content-Type": "application/json"}
        ))

        # Set fake token
        page.add_init_script("localStorage.setItem('token', 'fake-token')")

        print("Navigating to Create Team...")
        page.goto("http://localhost:3001/franchise/create")

        # Create Team Flow
        page.fill('input[placeholder="Riverport Raccoons"]', "Test Team")
        page.click('button:has-text("Create Franchise")')

        # Wait for navigation to Hub
        page.wait_for_url("**/franchise/hub/test-team-123")
        print("Navigated to Hub")

        # Check Initial State
        page.wait_for_selector('text=Test Team')
        page.wait_for_selector('text=Skill Pool Cap')

        # Take Screenshot 1: Hub Empty
        page.screenshot(path="/home/jules/verification/hub_empty.png")
        print("Screenshot 1: Empty Hub")

        # Recruit Player
        page.click('button:has-text("+ Recruit")')
        page.fill('input[value=""]', "Ace Pitcher") # Name input in modal
        page.select_option('select', "P")
        page.click('button:has-text("Sign Contract")')

        # Wait for player to appear (mocked response triggers update)
        # Note: Our mock returns specific player data, ensure RosterEditor renders it.
        # But wait, our mock for /players returns 'New Player' name, but input was 'Ace Pitcher'.
        # The frontend re-fetches team after add.
        # We need to update the mock for /teams/test-team-123 to include the player on second call.

        # Update Mock for GET team
        page.route("**/api/teams/test-team-123", lambda route: route.fulfill(
            status=200,
            body='{"id": "test-team-123", "name": "Test Team", "skill_pool": 30, "roster": [{"id":"p1", "name":"Ace Pitcher", "position":"P", "stats":{"power":1,"contact":1,"speed":1,"defense":1}}]}',
            headers={"Content-Type": "application/json"}
        ))

        # Trigger reload (happens automatically in component on success, but verifying)
        # Actually RosterEditor calls onUpdate -> fetchTeam.
        # So it should auto-update.

        page.wait_for_selector('text=Ace Pitcher')
        print("Player Recruited")

        # Adjust Stats
        # Locate sliders.
        # We need to interact with range inputs.
        # Let's set Power to 5.
        # Slider is input[type=range]. First one should be power.
        sliders = page.query_selector_all('input[type="range"]')
        if sliders:
            # First slider is Power (based on STAT_NAMES order in code)
            sliders[0].fill("5")
            # Dispatch input event if needed, fill() on range usually works in PW?
            # PW fill on range might not trigger 'change/input'.
            # Better to use evaluate
            page.evaluate("document.querySelectorAll('input[type=range]')[0].value = 5")
            page.evaluate("document.querySelectorAll('input[type=range]')[0].dispatchEvent(new Event('input', { bubbles: true }))")
            page.evaluate("document.querySelectorAll('input[type=range]')[0].dispatchEvent(new Event('change', { bubbles: true }))")

        # Check Cost Update
        # Cost for 1->5 is 4 points. Remaining should be 26.
        page.wait_for_selector('text=26')
        print("Cost Updated")

        # Take Screenshot 2: Hub Populated
        page.screenshot(path="/home/jules/verification/hub_populated.png")
        print("Screenshot 2: Populated Hub")

        # Save
        page.click('button:has-text("Save Roster")')
        # Expect button to disable/loading then re-enable

        browser.close()

if __name__ == "__main__":
    verify_frontend()
