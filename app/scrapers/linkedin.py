"""
LinkedIn's "guest" job search endpoint returns an HTML fragment without
requiring login. It is rate-limited and will start returning 429s or empty
pages under aggressive polling -- hence the request delay between calls
and the 15-min interval in config.SCRAPE_INTERVAL_MINUTES. On a 429/403
mid-run, the scraper keeps whatever it already fetched instead of failing.

Coverage: one search per keyword in SEARCH_KEYWORDS_LIST, several pages
each. The search cards don't include the job description, so for jobs
whose title/location already look like a match, the full JD is fetched
from the per-job guest endpoint (also no login) -- that's what lets the
work-mode filter and the summary column actually work for LinkedIn rows.
"""
import re
import time
from datetime import datetime
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

from app.config import (
    LINKEDIN_MAX_DESCRIPTION_FETCHES,
    LINKEDIN_PAGE_SIZE,
    LINKEDIN_PAGES_PER_KEYWORD,
    LINKEDIN_POSTED_WITHIN_SECONDS,
    LINKEDIN_REQUEST_DELAY_SECONDS,
    SEARCH_KEYWORDS_LIST,
    SEARCH_LOCATION,
)
from app.filters import RawJob, location_matches, title_matches
from app.scrapers.base import BaseScraper, http_get, logger

SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
JOB_POSTING_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"


class LinkedInScraper(BaseScraper):
    name = "linkedin"

    def fetch(self) -> List[RawJob]:
        jobs_by_id: Dict[str, RawJob] = {}
        rate_limited = False

        for keyword in SEARCH_KEYWORDS_LIST:
            if rate_limited:
                break
            for page_i in range(LINKEDIN_PAGES_PER_KEYWORD):
                params = {
                    "keywords": keyword,
                    "location": SEARCH_LOCATION,
                    "f_TPR": f"r{LINKEDIN_POSTED_WITHIN_SECONDS}",
                    "start": page_i * LINKEDIN_PAGE_SIZE,
                }
                try:
                    resp = http_get(SEARCH_URL, params=params)
                except requests.HTTPError as exc:
                    status = exc.response.status_code if exc.response is not None else 0
                    if status in (429, 403):
                        logger.warning(
                            "[linkedin] rate limited (HTTP %d) after %d jobs; keeping partial results",
                            status, len(jobs_by_id),
                        )
                        rate_limited = True
                        break
                    raise

                page_jobs = self._parse_search_fragment(resp.text)
                for job in page_jobs:
                    jobs_by_id.setdefault(job.source_job_id, job)

                if not page_jobs:
                    break  # no more results for this keyword
                time.sleep(LINKEDIN_REQUEST_DELAY_SECONDS)

        self._enrich_descriptions(jobs_by_id)
        return list(jobs_by_id.values())

    def _parse_search_fragment(self, html: str) -> List[RawJob]:
        soup = BeautifulSoup(html, "html.parser")
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
    def _enrich_descriptions(jobs_by_id: Dict[str, RawJob]) -> None:
        """Fetch full JDs for jobs that already look like matches, so the
        work-mode/employment-type filters have real text to work with."""
        candidates = [
            j for j in jobs_by_id.values()
            if title_matches(j.title)
            and (location_matches(j.location_raw) or re.search(r"\bremote\b", j.location_raw or "", re.I))
        ]
        for job in candidates[:LINKEDIN_MAX_DESCRIPTION_FETCHES]:
            time.sleep(LINKEDIN_REQUEST_DELAY_SECONDS)
            try:
                resp = http_get(JOB_POSTING_URL.format(job_id=job.source_job_id))
                soup = BeautifulSoup(resp.text, "html.parser")
                markup = soup.select_one("div.show-more-less-html__markup")
                if markup:
                    text = markup.get_text(" ", strip=True)
                    job.description_text = text
                    job.summary = text[:400]
            except Exception as exc:  # noqa: BLE001 - enrichment is best-effort
                logger.info("[linkedin] JD fetch failed for %s: %s", job.source_job_id, exc)

    @staticmethod
    def _parse_card(card) -> Optional[RawJob]:
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
            description_text="",  # filled by _enrich_descriptions for likely matches
            work_mode_hint="",
            employment_type_raw="",
            salary_raw="",
            summary="",
        )
