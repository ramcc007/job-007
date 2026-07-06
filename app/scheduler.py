import logging
from collections import Counter
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app import diagnostics
from app.config import EXTENDED_WINDOW_DAYS, SCRAPE_INTERVAL_MINUTES
from app.database import get_session
from app.filters import evaluate
from app.models import Job, normalize_for_dedup
from app.scrapers import ALL_SCRAPERS

logger = logging.getLogger("job_radar.scheduler")


def run_source(name: str):
    scraper = ALL_SCRAPERS[name]
    raw_jobs = scraper.safe_fetch()
    now = datetime.utcnow()

    matched = 0
    reject_reasons = Counter()
    sample_rejects = []
    session = get_session()
    try:
        for raw in raw_jobs:
            passes, reason, work_mode, hybrid_days = evaluate(raw, now=now)
            if not passes:
                reject_reasons[reason] += 1
                if len(sample_rejects) < 5:
                    sample_rejects.append(f"{reason}: \"{raw.title}\" @ {raw.company} ({raw.location_raw})")
                continue

            dedup_key = normalize_for_dedup(raw.title, raw.company)
            stmt = (
                sqlite_insert(Job)
                .values(
                    source=raw.source,
                    source_job_id=raw.source_job_id,
                    url=raw.url,
                    title=raw.title,
                    company=raw.company,
                    location_raw=raw.location_raw,
                    work_mode=work_mode,
                    hybrid_office_days=hybrid_days,
                    employment_type_raw=raw.employment_type_raw,
                    salary_raw=raw.salary_raw,
                    summary=raw.summary,
                    posted_date=raw.posted_date,
                    scraped_at=now,
                    dedup_key=dedup_key,
                )
                .on_conflict_do_update(
                    index_elements=["source", "source_job_id"],
                    # posted_date deliberately NOT updated on re-scrape:
                    # sources without a real posting date report "now" each
                    # cycle, which would pin the job at "0d ago" forever.
                    # Keeping the first-inserted value gives first-seen
                    # semantics and lets listings age out correctly.
                    set_={
                        "url": raw.url,
                        "title": raw.title,
                        "company": raw.company,
                        "location_raw": raw.location_raw,
                        "work_mode": work_mode,
                        "hybrid_office_days": hybrid_days,
                        "employment_type_raw": raw.employment_type_raw,
                        "salary_raw": raw.salary_raw,
                        "summary": raw.summary,
                        "scraped_at": now,
                        "dedup_key": dedup_key,
                    },
                )
            )
            session.execute(stmt)
            matched += 1
        session.commit()
    finally:
        session.close()

    logger.info("[%s] %d/%d listings matched filters and were stored", name, matched, len(raw_jobs))
    if raw_jobs and matched == 0:
        logger.info("[%s] reject reasons: %s", name, dict(reject_reasons))
        for sample in sample_rejects:
            logger.info("[%s] rejected sample -> %s", name, sample)

    diagnostics.record(
        name,
        raw_fetched=len(raw_jobs),
        matched=matched,
        reject_reasons=dict(reject_reasons),
        sample_rejects=sample_rejects,
    )


def purge_old_jobs():
    cutoff = datetime.utcnow() - timedelta(days=EXTENDED_WINDOW_DAYS)
    session = get_session()
    try:
        deleted = session.query(Job).filter(Job.posted_date < cutoff).delete()
        session.commit()
        if deleted:
            logger.info("purged %d listings older than %d days", deleted, EXTENDED_WINDOW_DAYS)
    finally:
        session.close()


def run_all_sources():
    for name in ALL_SCRAPERS:
        run_source(name)
    purge_old_jobs()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    for name, interval in SCRAPE_INTERVAL_MINUTES.items():
        scheduler.add_job(
            run_source,
            "interval",
            minutes=interval,
            args=[name],
            id=f"scrape_{name}",
            next_run_time=datetime.utcnow(),  # fire once immediately on startup
            max_instances=1,
            coalesce=True,
        )
    scheduler.add_job(
        purge_old_jobs,
        "interval",
        minutes=5,
        id="purge_old_jobs",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    return scheduler
