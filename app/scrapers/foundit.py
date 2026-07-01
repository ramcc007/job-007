"""
Foundit (formerly Monster India) renders search results client-side and
backs them with a JSON search API. The endpoint/payload shape below is
inferred and the most likely of the five scrapers to need adjustment --
open foundit.in's search page in a browser, check the Network tab for the
XHR request the search box triggers, and update SEARCH_URL/payload/parsing
to match if this returns 0 results.
"""
from datetime import datetime
from typing import List

from dateutil import parser as dateutil_parser

from app.config import SEARCH_KEYWORDS, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, http_get

SEARCH_URL = "https://www.foundit.in/middleware/jobsearch"


class FounditScraper(BaseScraper):
    name = "foundit"

    def fetch(self) -> List[RawJob]:
        params = {
            "query": SEARCH_KEYWORDS,
            "locations": SEARCH_LOCATION,
            "sort": "1",  # most recent first
            "days": 15,
        }
        headers = {"Accept": "application/json"}
        resp = http_get(SEARCH_URL, params=params, headers=headers)
        data = resp.json()

        jobs: List[RawJob] = []
        results = data.get("jobs") or data.get("results") or []
        for item in results:
            try:
                job = self._parse_item(item)
                if job:
                    jobs.append(job)
            except Exception:  # noqa: BLE001
                continue
        return jobs

    @staticmethod
    def _parse_item(item: dict) -> RawJob:
        job_id = str(item.get("jobId") or item.get("id") or "")
        if not job_id:
            return None

        title = item.get("title") or item.get("jobTitle", "")
        company = item.get("companyName") or item.get("company", "")
        location = item.get("location") or item.get("locations", "")
        description = item.get("description") or item.get("jobDescription", "")

        posted_raw = item.get("postedDate") or item.get("createDate")
        try:
            posted_date = dateutil_parser.parse(posted_raw) if posted_raw else datetime.utcnow()
            if posted_date.tzinfo:
                posted_date = posted_date.replace(tzinfo=None)
        except (ValueError, TypeError):
            posted_date = datetime.utcnow()

        url = item.get("jobUrl") or item.get("url") or (f"https://www.foundit.in/job/{job_id}" if job_id else "")

        return RawJob(
            source="foundit",
            source_job_id=job_id,
            url=url,
            title=title,
            company=company or "",
            location_raw=location if isinstance(location, str) else ", ".join(location or []),
            posted_date=posted_date,
            description_text=description or "",
            work_mode_hint=item.get("workMode", ""),
            employment_type_raw=item.get("employmentType", ""),
            salary_raw=item.get("salary", ""),
            summary=(description or "")[:400],
        )
