"""
Naukri runs Akamai Bot Manager plus a per-request signed token generated
by obfuscated client-side JS, so it cannot be scraped with plain HTTP
requests (confirmed: a bare requests.get() against their JSON API returns
406 Not Acceptable even with correct-looking headers). Instead this drives
a real, persistent, logged-in Chromium session via Playwright -- run
scripts/setup_naukri_login.py once to create that session, then this
module reuses it on every scheduled run.

If this starts returning 0 jobs while the search page clearly has
results when you check manually, the site's markup likely changed --
open a Naukri search results page, right-click a job card -> Inspect, and
update the CSS selectors in _parse_card() below to match.
"""
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from app.config import (
    NAUKRI_HEADLESS,
    NAUKRI_PAGE_TIMEOUT_MS,
    NAUKRI_PROFILE_DIR,
    NAUKRI_SEARCH_URL,
    USER_AGENT,
)
from app.filters import RawJob
from app.scrapers.base import BaseScraper

CARD_SELECTOR = "div.srp-jobtuple-wrapper, article.jobTuple"


class NaukriScraper(BaseScraper):
    name = "naukri"

    def fetch(self) -> List[RawJob]:
        profile_dir = Path(NAUKRI_PROFILE_DIR).resolve()
        if not profile_dir.exists():
            raise RuntimeError(
                "Naukri login profile not found. Run "
                "`python scripts/setup_naukri_login.py` once before starting the app."
            )

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=NAUKRI_HEADLESS,
                user_agent=USER_AGENT,
                viewport={"width": 1280, "height": 900},
            )
            try:
                page = context.new_page()
                page.goto(NAUKRI_SEARCH_URL, timeout=NAUKRI_PAGE_TIMEOUT_MS)
                page.wait_for_selector(CARD_SELECTOR, timeout=NAUKRI_PAGE_TIMEOUT_MS)
                html = page.content()
            finally:
                context.close()

        soup = BeautifulSoup(html, "html.parser")
        jobs: List[RawJob] = []
        for card in soup.select(CARD_SELECTOR):
            try:
                job = self._parse_card(card)
                if job:
                    jobs.append(job)
            except Exception:  # noqa: BLE001
                continue
        return jobs

    @staticmethod
    def _parse_card(card) -> Optional[RawJob]:
        title_el = card.select_one("a.title")
        if not title_el:
            return None

        url = title_el.get("href", "")
        title = title_el.get_text(strip=True)

        company_el = card.select_one("a.comp-name") or card.select_one(".comp-name")
        location_el = card.select_one(".locWdth") or card.select_one(".loc") or card.select_one("[title*='ocation']")
        salary_el = card.select_one(".sal") or card.select_one(".salary")
        posted_el = card.select_one(".job-post-day")

        job_id_match = re.search(r"-(\d+)(?:$|\?)", url)
        job_id = job_id_match.group(1) if job_id_match else (card.get("data-job-id") or url)

        posted_date = _parse_relative_date(posted_el.get_text(strip=True) if posted_el else "")

        return RawJob(
            source="naukri",
            source_job_id=str(job_id),
            url=url,
            title=title,
            company=company_el.get_text(strip=True) if company_el else "",
            location_raw=location_el.get_text(strip=True) if location_el else "",
            posted_date=posted_date,
            description_text="",  # not fetched per-listing to keep browsing footprint low
            work_mode_hint="",
            employment_type_raw="",
            salary_raw=salary_el.get_text(strip=True) if salary_el else "",
            summary="",
        )


def _parse_relative_date(text: str) -> datetime:
    text = (text or "").lower().strip()
    now = datetime.utcnow()
    if not text or "today" in text or "just now" in text:
        return now
    hours_match = re.search(r"(\d+)\s*hour", text)
    if hours_match:
        return now - timedelta(hours=int(hours_match.group(1)))
    days_match = re.search(r"(\d+)\+?\s*day", text)
    if days_match:
        return now - timedelta(days=int(days_match.group(1)))
    return now
