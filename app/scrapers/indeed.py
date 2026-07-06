"""
Indeed blocks plain HTTP requests with a 403 bot-fingerprint check
(confirmed live -- correct headers alone don't pass), so this fetches
search pages through a real anonymous Chromium session instead. Indeed
may still occasionally serve a CAPTCHA/verification interstitial; when
that happens the run logs a hint and returns whatever parsed.

fromage=14 is Indeed's longest supported freshness filter tier below a
month; the app's own recency filter handles the exact 15/30-day buckets.
"""
import re
from typing import Dict, List, Optional
from urllib.parse import quote

from bs4 import BeautifulSoup

from app.config import SEARCH_KEYWORDS_LIST, SEARCH_LOCATION
from app.filters import RawJob
from app.scrapers.base import BaseScraper, logger, parse_relative_date
from app.scrapers.browser import dump_debug_html, fetch_pages_with_browser

CARD_SELECTOR = "div.job_seen_beacon"

INDEED_KEYWORDS = SEARCH_KEYWORDS_LIST[:2]


def _build_search_url(keyword: str) -> str:
    return (
        f"https://in.indeed.com/jobs?q={quote(keyword)}"
        f"&l={quote(SEARCH_LOCATION)}&fromage=14&sort=date"
    )


class IndeedScraper(BaseScraper):
    name = "indeed"

    def fetch(self) -> List[RawJob]:
        urls = [_build_search_url(kw) for kw in INDEED_KEYWORDS]
        htmls = fetch_pages_with_browser(urls, wait_selector=CARD_SELECTOR)

        jobs_by_id: Dict[str, RawJob] = {}
        for i, html in enumerate(htmls.values()):
            if not html:
                continue
            soup = BeautifulSoup(html, "html.parser")
            cards = soup.select(CARD_SELECTOR)
            if not cards:
                if re.search(r"captcha|verify you are|are you a robot", html, re.I):
                    logger.warning("[indeed] served a verification challenge instead of results")
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
        title_el = card.select_one("h2.jobTitle span")
        company_el = card.select_one("span.companyName") or card.select_one("[data-testid='company-name']")
        location_el = card.select_one("div.companyLocation") or card.select_one("[data-testid='text-location']")
        link_el = card.select_one("h2.jobTitle a")
        snippet_el = card.select_one("div.job-snippet") or card.select_one("[class*='snippet']")
        salary_el = card.select_one("[class*='salary-snippet']") or card.select_one("[data-testid='attribute_snippet_testid']")

        if not (title_el and link_el):
            return None

        href = link_el.get("href", "")
        job_id_match = re.search(r"jk=([a-f0-9]+)", href)
        job_id = job_id_match.group(1) if job_id_match else href
        url = f"https://in.indeed.com/viewjob?jk={job_id}" if job_id_match else f"https://in.indeed.com{href}"

        age_el = card.select_one("span.date") or card.select_one("[data-testid='myJobsStateDate']")
        posted_date = parse_relative_date(age_el.get_text(strip=True) if age_el else "")

        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""

        return RawJob(
            source="indeed",
            source_job_id=job_id,
            url=url,
            title=title_el.get_text(strip=True),
            company=company_el.get_text(strip=True) if company_el else "",
            location_raw=location_el.get_text(strip=True) if location_el else "",
            posted_date=posted_date,
            description_text=snippet,
            work_mode_hint="",
            employment_type_raw="",
            salary_raw=salary_el.get_text(strip=True) if salary_el else "",
            summary=snippet[:400],
        )
