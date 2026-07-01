import logging
from abc import ABC, abstractmethod
from typing import List

import requests

from app.config import HTTP_TIMEOUT_SECONDS, USER_AGENT
from app.filters import RawJob

logger = logging.getLogger("job_radar.scrapers")


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
        try:
            jobs = self.fetch()
            logger.info("[%s] fetched %d raw listings", self.name, len(jobs))
            return jobs
        except Exception as exc:  # noqa: BLE001 - intentionally broad, see docstring
            logger.warning("[%s] scrape failed: %s", self.name, exc)
            return []
