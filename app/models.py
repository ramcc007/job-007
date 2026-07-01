import re

from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def normalize_for_dedup(title: str, company: str) -> str:
    """Collapse whitespace/case/punctuation so the same job posted on
    multiple boards collapses to one dedup key."""
    text = f"{title}|{company}".lower()
    text = re.sub(r"[^a-z0-9|]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source", "source_job_id", name="uq_source_job"),)

    id = Column(Integer, primary_key=True, autoincrement=True)

    source = Column(String(50), nullable=False)
    source_job_id = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)

    title = Column(String(500), nullable=False)
    company = Column(String(300), nullable=False)
    location_raw = Column(String(500))
    work_mode = Column(String(30))          # Remote | Hybrid | Onsite | Unspecified
    hybrid_office_days = Column(Integer)    # parsed day count, nullable
    employment_type_raw = Column(String(200))
    salary_raw = Column(String(200))
    summary = Column(Text)

    posted_date = Column(DateTime, nullable=False)
    scraped_at = Column(DateTime, nullable=False)

    dedup_key = Column(String(700), index=True, nullable=False)

    def as_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "url": self.url,
            "title": self.title,
            "company": self.company,
            "location": self.location_raw,
            "work_mode": self.work_mode,
            "hybrid_office_days": self.hybrid_office_days,
            "employment_type": self.employment_type_raw,
            "salary": self.salary_raw,
            "summary": self.summary,
            "posted_date": self.posted_date.isoformat() if self.posted_date else None,
            "scraped_at": self.scraped_at.isoformat() if self.scraped_at else None,
        }
