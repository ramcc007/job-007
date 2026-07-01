import logging
from collections import defaultdict
from datetime import datetime

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import EXTENDED_WINDOW_DAYS, RECENT_WINDOW_DAYS, SCRAPE_INTERVAL_MINUTES
from app.database import get_session, init_db
from app.filters import recency_bucket
from app.models import Job
from app.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Digital Marketing Director Job Radar - Gurgaon")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_scheduler = None


@app.on_event("startup")
def on_startup():
    global _scheduler
    init_db()
    _scheduler = start_scheduler()


@app.get("/api/jobs")
def list_jobs(
    bucket: str = Query("recent", pattern="^(recent|extended|all)$"),
    work_mode: str = Query("all"),
    source: str = Query("all"),
    q: str = Query(""),
):
    session = get_session()
    try:
        rows = session.query(Job).order_by(Job.posted_date.desc()).all()
    finally:
        session.close()

    now = datetime.utcnow()
    groups = defaultdict(list)
    for row in rows:
        b = recency_bucket(row.posted_date, now)
        if b is None:
            continue
        if bucket != "all" and b != bucket:
            continue
        if work_mode != "all" and (row.work_mode or "Unspecified") != work_mode:
            continue
        if source != "all" and row.source != source:
            continue
        if q:
            haystack = f"{row.title} {row.company}".lower()
            if q.lower() not in haystack:
                continue
        groups[row.dedup_key].append(row)

    results = []
    for dedup_key, rows_in_group in groups.items():
        rows_in_group.sort(key=lambda r: r.posted_date, reverse=True)
        primary = rows_in_group[0]
        d = primary.as_dict()
        d["bucket"] = recency_bucket(primary.posted_date, now)
        d["other_sources"] = [
            {"source": r.source, "url": r.url} for r in rows_in_group[1:]
        ]
        results.append(d)

    results.sort(key=lambda d: d["posted_date"], reverse=True)
    return {"count": len(results), "jobs": results}


@app.get("/api/status")
def status():
    session = get_session()
    try:
        total = session.query(Job).count()
        counts = defaultdict(int)
        for row in session.query(Job.source).all():
            counts[row.source] += 1
    finally:
        session.close()

    return {
        "total_stored": total,
        "counts_by_source": dict(counts),
        "recent_window_days": RECENT_WINDOW_DAYS,
        "extended_window_days": EXTENDED_WINDOW_DAYS,
        "refresh_intervals_minutes": SCRAPE_INTERVAL_MINUTES,
        "server_time_utc": datetime.utcnow().isoformat(),
    }


app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def index():
    return FileResponse("app/static/index.html")
