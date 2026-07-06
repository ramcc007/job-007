"""
Naukri runs Akamai Bot Manager plus a per-request signed token generated
by obfuscated client-side JS, so it cannot be scraped with plain HTTP
requests (confirmed: a bare requests.get() against their JSON API returns
406 Not Acceptable even with correct-looking headers). Instead this drives
a real, persistent, logged-in Chromium session via Playwright -- run
scripts/setup_naukri_login.py once to create that session, then this
module reuses it on every scheduled run.

One search page is fetched per keyword in SEARCH_KEYWORDS_LIST, all
within a single browser launch, sorted by freshness so the newest
postings surface first.

If this starts returning 0 jobs while the search page clearly has
results when you check manually, the site's markup likely changed --
open a Naukri search results page, right-click a job card -> Inspect, and
update the CSS selectors in _parse_card() below to match.
"""
import re
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote

from bs4 import BeautifulSoup

from app.config import NAUKRI_PROFILE_DIR, SEARCH_KEYWORDS_LIST
from app.filters import RawJob
from app.scrapers.base import BaseScraper, parse_relative_date
from app.scrapers.browser import dump_debug_html, fetch_pages_with_browser

CARD_SELECTOR = "div.srp-jobtuple-wrapper, article.jobTuple"

# Keep Naukri's per-cycle footprint modest: one page per keyword, top
# variants only. sort=f = freshness (newest first).
NAUKRI_KEYWORDS = SEARCH_KEYWORDS_LIST[:3]


def _build_search_url(keyword: str) -> str:
    slug = keyword.lower().replace(" ", "-")
    return (
        f"https://www.naukri.com/{slug}-jobs-in-gurugram"
        f"?k={quote(keyword)}&l=gurugram&sort=f"
    )


class NaukriScraper(BaseScraper):
    name = "naukri"

    def fetch(self) -> List[RawJob]:
        profile_dir = Path(NAUKRI_PROFILE_DIR).resolve()
        if not profile_dir.exists():
            raise RuntimeError(
                "Naukri login profile not found. Run "
                "`python scripts/setup_naukri_login.py` once before starting the app."
            )

        urls = [_build_search_url(kw) for kw in NAUKRI_KEYWORDS]
        htmls = fetch_pages_with_browser(
            urls, wait_selector=CARD_SELECTOR, profile_dir=str(profile_dir)
        )

        jobs_by_id: Dict[str, RawJob] = {}
        for i, html in enumerate(htmls.values()):
            if not html:
                continue
            soup = BeautifulSoup(html, "html.parser")
            cards = soup.select(CARD_SELECTOR)
            if not cards:
                dump_debug_html(self.name, html, i)
                continue
            for card in cards:
                try:
                    job = self._parse_card(card)
                    if job:
                        jobs_by_id.setdefault(job.source_job_id, job)
                except Exception:  # noqa: BLE001
                    continue
        return list(jobs_by_id.values())

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

        posted_date = parse_relative_date(posted_el.get_text(strip=True) if posted_el else "")

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
