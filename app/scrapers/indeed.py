"""
Indeed serves standard HTML search results and does not require login,
but it actively fingerprints bot-like traffic and may occasionally return
a CAPTCHA/verification page instead of results. If fetch() starts
returning 0 jobs, check resp.text for a captcha challenge before assuming
the CSS selectors below are stale.
"""
import re
from datetime import datetime, timedelta
from typing import List

from bs4 import BeautifulSoup

from app.config import SEARCH_KEYWORDS, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, http_get

SEARCH_URL = "https://in.indeed.com/jobs"


class IndeedScraper(BaseScraper):
    name = "indeed"

    def fetch(self) -> List[RawJob]:
        params = {
            "q": SEARCH_KEYWORDS,
            "l": SEARCH_LOCATION,
            "fromage": 15,
            "sort": "date",
        }
        resp = http_get(SEARCH_URL, params=params)
        soup = BeautifulSoup(resp.text, "lxml")

        jobs: List[RawJob] = []
        for card in soup.select("div.job_seen_beacon"):
            try:
                job = self._parse_card(card)
                if job:
                    jobs.append(job)
            except Exception:  # noqa: BLE001
                continue
        return jobs

    @staticmethod
    def _parse_card(card) -> RawJob:
        title_el = card.select_one("h2.jobTitle span")
        company_el = card.select_one("span.companyName")
        location_el = card.select_one("div.companyLocation")
        link_el = card.select_one("h2.jobTitle a")
        snippet_el = card.select_one("div.job-snippet")

        if not (title_el and link_el):
            return None

        href = link_el.get("href", "")
        job_id_match = re.search(r"jk=([a-f0-9]+)", href)
        job_id = job_id_match.group(1) if job_id_match else href
        url = f"https://in.indeed.com/viewjob?jk={job_id}" if job_id_match else f"https://in.indeed.com{href}"

        posted_date = datetime.utcnow()
        age_el = card.select_one("span.date")
        if age_el:
            age_text = age_el.get_text(strip=True)
            days_match = re.search(r"(\d+)\+?\s*day", age_text)
            if days_match:
                posted_date = datetime.utcnow() - timedelta(days=int(days_match.group(1)))
            elif "today" in age_text.lower() or "just posted" in age_text.lower():
                posted_date = datetime.utcnow()

        return RawJob(
            source="indeed",
            source_job_id=job_id,
            url=url,
            title=title_el.get_text(strip=True),
            company=company_el.get_text(strip=True) if company_el else "",
            location_raw=location_el.get_text(strip=True) if location_el else "",
            posted_date=posted_date,
            description_text=snippet_el.get_text(" ", strip=True) if snippet_el else "",
            work_mode_hint="",
            employment_type_raw="",
            salary_raw="",
            summary=snippet_el.get_text(" ", strip=True)[:400] if snippet_el else "",
        )
