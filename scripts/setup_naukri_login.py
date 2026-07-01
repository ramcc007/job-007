"""
Run this once (`python scripts/setup_naukri_login.py`) before starting the
main app. It opens a real, visible Chromium window pointed at naukri.com
and saves your login session to a local profile folder
(config.NAUKRI_PROFILE_DIR). Log in normally in that window, then come
back to this terminal and press Enter -- the scraper will reuse that
saved session on every future run without needing you to log in again or
paste any cookies/tokens manually.

Re-run this script whenever Naukri logs your session out (sessions
typically last weeks, not hours, once saved this way).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from playwright.sync_api import sync_playwright

from app.config import NAUKRI_PROFILE_DIR


def main():
    profile_dir = Path(NAUKRI_PROFILE_DIR).resolve()
    profile_dir.mkdir(exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()
        page.goto("https://www.naukri.com/nlogin/login")
        print("\nA browser window has opened. Log in to Naukri normally.")
        input("Once you're logged in and can see your Naukri homepage/dashboard, press Enter here to save and close...\n")
        context.close()

    print(f"Session saved to {profile_dir}. You can now run `python run.py` normally.")


if __name__ == "__main__":
    main()
