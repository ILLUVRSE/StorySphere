from playwright.sync_api import Page, expect, sync_playwright
import time
import urllib.request
import json
import sys

def create_job():
    url = "http://localhost:3000/api/v1/generate"
    data = {"prompt":"Live log test","title":"Live Logs","style":"cinematic","voice":"default","language":"en","duration_target":10,"produce_preview":True}
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    print(f"Creating job at {url}...")
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            print(f"Job created: {res}")
            return res['jobId']
    except Exception as e:
        print(f"Failed to create job: {e}")
        raise e

def verify_live_logs(page: Page):
    # Create job
    job_id = create_job()

    # Navigate immediately
    url = f"http://localhost:3001/jobs/{job_id}"
    print(f"Navigating to {url}...")
    page.goto(url)

    # Check for title
    expect(page.get_by_role("heading", name=f"Job {job_id}")).to_be_visible()

    # Wait for "connected" message (initial SSE)
    print("Waiting for 'connected' log...")
    expect(page.get_by_text("connected")).to_be_visible(timeout=20000)

    # Wait for at least one worker log
    # e.g. "Step 1"
    print("Waiting for 'Step 1' log...")
    expect(page.get_by_text("Step 1: Generating script")).to_be_visible(timeout=40000)

    # Take screenshot
    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/live_logs.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_live_logs(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification failed: {e}")
            sys.exit(1)
        finally:
            browser.close()
