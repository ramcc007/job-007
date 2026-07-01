"""
Naukri exposes a public JSON search endpoint used by their own web
frontend (no login required). It is not a documented/official public API,
so the response shape can change without notice -- if this starts
returning 0 results, open naukri.com/jobs search in a browser dev tools
Network tab, search "jobapi", and diff the response shape against the
parsing below.
"""
from datetime import datetime
from typing import List

from app.config import SEARCH_KEYWORDS, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, http_get

SEARCH_URL = "https://www.naukri.com/jobapi/v3/search"


class NaukriScraper(BaseScraper):
    name = "naukri"

    def fetch(self) -> List[RawJob]:
        params = {
            "noOfResults": 40,
            "urlType": "search_by_key_loc",
            "searchType": "adv",
            "keyword": SEARCH_KEYWORDS,
            "location": SEARCH_LOCATION,
            "k": SEARCH_KEYWORDS,
            "l": SEARCH_LOCATION,
            "sort": "d",  # sort by date
        }
        headers = {
            "Accept": "application/json",
            "appid": "109",
            "systemid": "Naukri",
            "clientid": "d3skt0p",
        }
        resp = http_get(SEARCH_URL, params=params, headers=headers)
        data = resp.json()

        jobs: List[RawJob] = []
        for item in data.get("jobDetails", []):
            try:
                jobs.append(self._parse_item(item))
            except Exception:  # noqa: BLE001 - skip malformed item, keep the rest
                continue
        return jobs

    @staticmethod
    def _parse_item(item: dict) -> RawJob:
        job_id = str(item.get("jobId"))
        title = item.get("title", "")
        company = item.get("companyName", "")
        placeholders = {p.get("type"): p.get("label") for p in item.get("placeholders", []) if isinstance(p, dict)}
        location = placeholders.get("location", "")
        salary = placeholders.get("salary", "")

        created_ms = item.get("createdDate") or item.get("footerPlaceholderLabel")
        try:
            posted_date = datetime.utcfromtimestamp(int(created_ms) / 1000)
        except (TypeError, ValueError):
            posted_date = datetime.utcnow()

        url = item.get("jdURL") or item.get("staticUrl") or ""
        if url and not url.startswith("http"):
            url = f"https://www.naukri.com{url}"

        description = item.get("jobDescription", "") or ""

        return RawJob(
            source="naukri",
            source_job_id=job_id,
            url=url,
            title=title,
            company=company,
            location_raw=location,
            posted_date=posted_date,
            description_text=description,
            work_mode_hint=placeholders.get("workMode", ""),
            employment_type_raw=placeholders.get("employmentType", ""),
            salary_raw=salary,
            summary=description[:400],
        )
