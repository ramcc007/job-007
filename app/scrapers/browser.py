"""
Shared real-browser fetching for sources whose plain HTTP endpoints are
blocked (Indeed 403 bot-fingerprint, Naukri 406 Akamai) or unknown
(Foundit, Instahyre). A single Chromium launch fetches all URLs for one
scraper run; a process-wide lock keeps scrapers from launching several
Chromium instances at once when their schedules line up.
"""
import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional

from playwright.sync_api import sync_playwright

from app.config import (
    BROWSER_HEADLESS,
    BROWSER_PAGE_TIMEOUT_MS,
    GENERIC_BROWSER_PROFILE_DIR,
    USER_AGENT,
)

logger = logging.getLogger("job_radar.scrapers")

_browser_lock = threading.Lock()


def fetch_pages_with_browser(
    urls: List[str],
    wait_selector: Optional[str] = None,
    profile_dir: Optional[str] = None,
    extra_wait_ms: int = 2500,
) -> Dict[str, str]:
    """Fetch each URL in a real Chromium and return {url: rendered_html}.
    A URL that fails to load maps to "" rather than raising, so one bad
    page doesn't lose the rest of the batch."""
    profile = Path(profile_dir or GENERIC_BROWSER_PROFILE_DIR).resolve()
    profile.mkdir(exist_ok=True)

    results: Dict[str, str] = {}
    with _browser_lock:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile),
                headless=BROWSER_HEADLESS,
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 900},
            )
            try:
                page = context.new_page()
                for url in urls:
                    try:
                        page.goto(url, timeout=BROWSER_PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
                        if wait_selector:
                            try:
                                page.wait_for_selector(wait_selector, timeout=10000)
                            except Exception:  # noqa: BLE001 - selector may be stale; grab what rendered
                                pass
                        # JS-rendered sites keep hydrating after DOMContentLoaded
                        page.wait_for_timeout(extra_wait_ms)
                        results[url] = page.content()
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("browser fetch failed for %s: %s", url, exc)
                        results[url] = ""
            finally:
                context.close()
    return results
