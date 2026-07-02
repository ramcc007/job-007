"""
Instahyre's search is a JS app whose internal API rejected direct HTTP
calls (404 on the guessed endpoint), so the search page is fetched
through a real anonymous Chromium session and job links are harvested
from the rendered DOM. Note Instahyre gates much of its content behind
candidate login; if this consistently returns 0 while the site shows
results in your own browser, the pragmatic options are (a) log in once
inside the shared .browser_profile the same way the Naukri setup script
works, or (b) rely on the other sources -- Instahyre's Gurgaon
director-level marketing inventory is small anyway.
"""
import re
from typing import Dict, List
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from app.config import SEARCH_KEYWORDS_LIST
from app.filters import RawJob
from app.scrapers.base import BaseScraper, logger, parse_relative_date
from app.scrapers.browser import fetch_pages_with_browser


def _build_search_url(keyword: str) -> str:
    return f"https://www.instahyre.com/search-jobs/?q={quote(keyword)}"


class InstahyreScraper(BaseScraper):
    name = "instahyre"

    def fetch(self) -> List[RawJob]:
        urls = [_build_search_url(kw) for kw in SEARCH_KEYWORDS_LIST[:2]]
        htmls = fetch_pages_with_browser(urls, wait_selector="a[href*='/job/']")

        jobs_by_id: Dict[str, RawJob] = {}
        for html in htmls.values():
            if not html:
                continue
            soup = BeautifulSoup(html, "html.parser")
            for a in soup.select("a[href*='/job/']"):
                title = a.get_text(" ", strip=True)
                href = urljoin("https://www.instahyre.com/", a.get("href", ""))
                job_id_match = re.search(r"/job/(\d+)", href)
                if not job_id_match or not title or len(title) < 5:
                    continue
                job_id = job_id_match.group(1)
                jobs_by_id.setdefault(
                    job_id,
                    RawJob(
                        source="instahyre",
                        source_job_id=job_id,
                        url=href,
                        title=title,
                        company="",
                        location_raw="",
                        posted_date=parse_relative_date(""),
                        description_text="",
                        work_mode_hint="",
                        employment_type_raw="",
                        salary_raw="",
                        summary="",
                    ),
                )
        if not jobs_by_id:
            logger.info("[instahyre] no job links found -- search results may require login (see module docstring)")
        return list(jobs_by_id.values())
