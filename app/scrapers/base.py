import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List

import requests

from app.config import HTTP_TIMEOUT_SECONDS, USER_AGENT
from app.filters import RawJob

logger = logging.getLogger("job_radar.scrapers")


def parse_relative_date(text: str) -> datetime:
    """'3 days ago' / '5 hours ago' / 'Just now' -> absolute UTC datetime.
    Unrecognized text maps to now; the scheduler never overwrites
    posted_date after first insert, so that acts as a first-seen date."""
    text = (text or "").lower().strip()
    now = datetime.utcnow()
    if not text or "today" in text or "just now" in text or "few" in text:
        return now
    hours_match = re.search(r"(\d+)\s*hour", text)
    if hours_match:
        return now - timedelta(hours=int(hours_match.group(1)))
    days_match = re.search(r"(\d+)\+?\s*day", text)
    if days_match:
        return now - timedelta(days=int(days_match.group(1)))
    weeks_match = re.search(r"(\d+)\+?\s*week", text)
    if weeks_match:
        return now - timedelta(weeks=int(weeks_match.group(1)))
    months_match = re.search(r"(\d+)\+?\s*month", text)
    if months_match:
        return now - timedelta(days=30 * int(months_match.group(1)))
    return now


def http_get(url: str, params: dict = None, headers: dict = None, timeout: int = HTTP_TIMEOUT_SECONDS):
    merged_headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
    if headers:
        merged_headers.update(headers)
    resp = requests.get(url, params=params, headers=merged_headers, timeout=timeout)
    resp.raise_for_status()
    return resp


class BaseScraper(ABC):
    name: str = "base"

    @abstractmethod
    def fetch(self) -> List[RawJob]:
        """Return raw listings for the configured search. Raise on hard
        failure (network error, unexpected response shape); safe_fetch()
        catches it so one broken source never takes down the scheduler."""
        raise NotImplementedError

    def safe_fetch(self) -> List[RawJob]:
        from app import diagnostics

        try:
            jobs = self.fetch()
            logger.info("[%s] fetched %d raw listings", self.name, len(jobs))
            diagnostics.record(self.name, error=None)
            return jobs
        except Exception as exc:  # noqa: BLE001 - intentionally broad, see docstring
            logger.warning("[%s] scrape failed: %s", self.name, exc)
            diagnostics.record(self.name, error=f"{type(exc).__name__}: {exc}")
            return []
