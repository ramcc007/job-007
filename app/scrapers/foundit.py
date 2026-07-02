"""
Foundit (formerly Monster India) renders search results client-side; its
internal JSON API rejected direct HTTP calls (400), so search pages are
fetched through a real anonymous Chromium session and parsed from the
rendered DOM. Class names on foundit.in are generated/verbose, so the
selectors below use attribute-contains matching plus a generic
link-harvest fallback -- if results still come back 0 while the site
shows jobs, inspect a job card in DevTools and adjust CARD_SELECTORS.
"""
import re
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from app.config import SEARCH_KEYWORDS_LIST, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, logger, parse_relative_date
from app.scrapers.browser import fetch_pages_with_browser

CARD_SELECTORS = "div[class*='srpResultCard'], div[class*='cardContainer'], div[class*='jobTuple']"

FOUNDIT_KEYWORDS = SEARCH_KEYWORDS_LIST[:2]


def _build_search_url(keyword: str) -> str:
    return (
        f"https://www.foundit.in/srp/results?query={quote(keyword)}"
        f"&locations={quote(SEARCH_LOCATION)}"
    )


class FounditScraper(BaseScraper):
    name = "foundit"

    def fetch(self) -> List[RawJob]:
        urls = [_build_search_url(kw) for kw in FOUNDIT_KEYWORDS]
        htmls = fetch_pages_with_browser(urls, wait_selector=CARD_SELECTORS)

        jobs_by_id: Dict[str, RawJob] = {}
        for html in htmls.values():
            if not html:
                continue
            soup = BeautifulSoup(html, "html.parser")
            cards = soup.select(CARD_SELECTORS)
            if cards:
                for card in cards:
                    try:
                        job = self._parse_card(card)
                        if job:
                            jobs_by_id.setdefault(job.source_job_id, job)
                    except Exception:  # noqa: BLE001
                        continue
            else:
                # Markup changed or unexpected page: harvest job links
                # generically so the source degrades instead of dying.
                harvested = self._harvest_links(soup)
                if harvested:
                    logger.info("[foundit] card selectors found nothing; link-harvest fallback got %d", len(harvested))
                for job in harvested:
                    jobs_by_id.setdefault(job.source_job_id, job)
        return list(jobs_by_id.values())

    @staticmethod
    def _parse_card(card) -> Optional[RawJob]:
        title_el = card.select_one("[class*='jobTitle'], h3 a, h2 a")
        if not title_el:
            return None
        link_el = title_el if title_el.name == "a" else (title_el.select_one("a") or card.select_one("a[href*='/job/']"))
        url = urljoin("https://www.foundit.in/", link_el.get("href", "")) if link_el else ""

        company_el = card.select_one("[class*='companyName'], [class*='company-name']")
        location_el = card.select_one("[class*='location'], [class*='details'] span")
        posted_el = card.select_one("[class*='timeText'], [class*='posted'], time")
        salary_el = card.select_one("[class*='salary'], [class*='package']")

        job_id_match = re.search(r"(\d{6,})", url)
        job_id = job_id_match.group(1) if job_id_match else url
        if not job_id:
            return None

        return RawJob(
            source="foundit",
            source_job_id=str(job_id),
            url=url,
            title=title_el.get_text(strip=True),
            company=company_el.get_text(strip=True) if company_el else "",
            location_raw=location_el.get_text(strip=True) if location_el else "",
            posted_date=parse_relative_date(posted_el.get_text(strip=True) if posted_el else ""),
            description_text="",
            work_mode_hint="",
            employment_type_raw="",
            salary_raw=salary_el.get_text(strip=True) if salary_el else "",
            summary="",
        )

    @staticmethod
    def _harvest_links(soup) -> List[RawJob]:
        jobs: List[RawJob] = []
        for a in soup.select("a[href*='/job/']"):
            title = a.get_text(strip=True)
            href = urljoin("https://www.foundit.in/", a.get("href", ""))
            if not title or len(title) < 5:
                continue
            job_id_match = re.search(r"(\d{6,})", href)
            if not job_id_match:
                continue
            jobs.append(
                RawJob(
                    source="foundit",
                    source_job_id=job_id_match.group(1),
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
                )
            )
        return jobs
