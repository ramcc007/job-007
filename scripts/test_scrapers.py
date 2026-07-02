"""
Run one or all scrapers once, outside the server, and print exactly what
came back and why rows were accepted/rejected. This is the fastest way to
debug a source that shows nothing on the dashboard.

Usage:
    python scripts/test_scrapers.py            # all sources
    python scripts/test_scrapers.py naukri     # just one
    python scripts/test_scrapers.py linkedin indeed
"""
import logging
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from app.filters import evaluate  # noqa: E402
from app.scrapers import ALL_SCRAPERS  # noqa: E402


def main():
    names = sys.argv[1:] or list(ALL_SCRAPERS)
    for name in names:
        if name not in ALL_SCRAPERS:
            print(f"unknown source '{name}' -- choose from {list(ALL_SCRAPERS)}")
            continue

        print(f"\n{'=' * 60}\n=== {name}\n{'=' * 60}")
        jobs = ALL_SCRAPERS[name].safe_fetch()
        print(f"raw listings fetched: {len(jobs)}")

        reasons = Counter()
        passed = []
        for raw in jobs:
            ok, reason, mode, days = evaluate(raw)
            if ok:
                passed.append((raw, mode, days))
            else:
                reasons[reason] += 1

        print(f"passed filters: {len(passed)}   rejected: {dict(reasons)}")
        for raw, mode, days in passed:
            days_note = f" ({days}d office)" if days is not None else ""
            print(f"  PASS  [{mode}{days_note}] {raw.title} @ {raw.company} | {raw.location_raw}")
        if jobs and not passed:
            print("  -- first few raw listings, for selector/filter diagnosis:")
            for raw in jobs[:8]:
                print(f"  RAW   {raw.title!r} @ {raw.company!r} | {raw.location_raw!r} | posted {raw.posted_date:%Y-%m-%d}")


if __name__ == "__main__":
    main()
