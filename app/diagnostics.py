"""
Per-source scrape diagnostics, kept in memory and surfaced on the
dashboard. Exists so a screenshot of the dashboard is enough to see
what every source did on its last run -- no terminal output needed.
"""
import threading
from datetime import datetime

_lock = threading.Lock()
_state: dict = {}


def record(source: str, **fields) -> None:
    with _lock:
        entry = _state.setdefault(source, {})
        entry.update(fields)
        entry["updated_at"] = datetime.utcnow().isoformat()


def snapshot() -> dict:
    with _lock:
        return {name: dict(entry) for name, entry in _state.items()}
