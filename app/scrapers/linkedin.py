"""
LinkedIn's "guest" job search endpoint returns an HTML fragment without
requiring login. It is rate-limited and will start returning 429s or empty
pages under aggressive polling -- that's why linkedin defaults to a 15-min
interval in config.SCRAPE_INTERVAL_MINUTES instead of 5. If this starts
returning 0 results consistently, LinkedIn likely changed markup or is
throttling this IP; back off further before assuming the parser is broken.
"""
import re
from datetime import datetime
from typing import List

from bs4 import BeautifulSoup

from app.config import SEARCH_KEYWORDS, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, http_get

SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"


class LinkedInScraper(BaseScraper):
    name = "linkedin"

    def fetch(self) -> List[RawJob]:
        params = {
            "keywords": SEARCH_KEYWORDS,
            "location": SEARCH_LOCATION,
            "f_TPR": "r1296000",  # postings within last 15 days, in seconds
            "start": 0,
        }
        resp = http_get(SEARCH_URL, params=params)
        soup = BeautifulSoup(resp.text, "lxml")

        jobs: List[RawJob] = []
        for card in soup.select("li"):
            try:
                job = self._parse_card(card)
                if job:
                    jobs.append(job)
            except Exception:  # noqa: BLE001 - skip malformed card, keep the rest
                continue
        return jobs

    @staticmethod
    def _parse_card(card) -> RawJob:
        link_el = card.select_one("a.base-card__full-link")
        title_el = card.select_one("h3.base-search-card__title")
        company_el = card.select_one("h4.base-search-card__subtitle")
        location_el = card.select_one("span.job-search-card__location")
        time_el = card.select_one("time")

        if not (link_el and title_el and company_el):
            return None

        url = link_el.get("href", "").split("?")[0]
        job_id_match = re.search(r"-(\d+)(?:$|\?)", link_el.get("href", ""))
        job_id = job_id_match.group(1) if job_id_match else url

        posted_date = datetime.utcnow()
        if time_el and time_el.get("datetime"):
            try:
                posted_date = datetime.strptime(time_el["datetime"], "%Y-%m-%d")
            except ValueError:
                pass

        return RawJob(
            source="linkedin",
            source_job_id=job_id,
            url=url,
            title=title_el.get_text(strip=True),
            company=company_el.get_text(strip=True),
            location_raw=location_el.get_text(strip=True) if location_el else "",
            posted_date=posted_date,
            description_text="",  # full JD requires a second authenticated request; not fetched
            work_mode_hint="",
            employment_type_raw="",
            salary_raw="",
            summary="",
        )
