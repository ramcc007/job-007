"""
Instahyre's public search results are rendered by a JS frontend backed by
a JSON API under /api/v1/. The endpoint/params below are inferred from
typical Instahyre search traffic; verify against the browser Network tab
(search "instahyre.com/api") if this returns 0 results, and adjust
SEARCH_URL/params/parsing accordingly.
"""
from datetime import datetime
from typing import List

from dateutil import parser as dateutil_parser

from app.config import SEARCH_KEYWORDS, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, http_get

SEARCH_URL = "https://www.instahyre.com/api/v1/search_jobs/"


class InstahyreScraper(BaseScraper):
    name = "instahyre"

    def fetch(self) -> List[RawJob]:
        params = {"q": SEARCH_KEYWORDS, "location": SEARCH_LOCATION}
        headers = {"Accept": "application/json", "X-Requested-With": "XMLHttpRequest"}
        resp = http_get(SEARCH_URL, params=params, headers=headers)
        data = resp.json()

        jobs: List[RawJob] = []
        results = data.get("objects", data if isinstance(data, list) else [])
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
        job_id = str(item.get("id") or item.get("job_id") or "")
        if not job_id:
            return None

        title = item.get("title") or item.get("job_title", "")
        company = (item.get("employer") or {}).get("name") if isinstance(item.get("employer"), dict) else item.get("company_name", "")
        location = item.get("location") or item.get("locations", "")
        description = item.get("description", "") or item.get("job_description", "")

        posted_raw = item.get("created_at") or item.get("posted_date")
        try:
            posted_date = dateutil_parser.parse(posted_raw) if posted_raw else datetime.utcnow()
            if posted_date.tzinfo:
                posted_date = posted_date.replace(tzinfo=None)
        except (ValueError, TypeError):
            posted_date = datetime.utcnow()

        url = item.get("url") or f"https://www.instahyre.com/job/{job_id}/"

        return RawJob(
            source="instahyre",
            source_job_id=job_id,
            url=url,
            title=title,
            company=company or "",
            location_raw=location if isinstance(location, str) else ", ".join(location or []),
            posted_date=posted_date,
            description_text=description,
            work_mode_hint=item.get("work_mode", ""),
            employment_type_raw=item.get("employment_type", ""),
            salary_raw=item.get("salary", "") or item.get("compensation", ""),
            summary=(description or "")[:400],
        )
