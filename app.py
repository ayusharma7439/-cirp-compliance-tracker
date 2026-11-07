"""CIRP Compliance Tracker - backend.

Serves the static site from ./docs and a small JSON API:
  GET  /health        liveness probe (also used by the site to detect this server)
  GET  /api/state     {rev, updated_at, state}
  PUT  /api/state     {base_rev, state} -> {rev}   (409 if base_rev is stale)

Optional protection: set API_KEY and the browser must send it as the X-API-Key header.
Optional email: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD and ALERT_EMAIL for a daily digest.
"""
import hashlib
import json
import logging
import os
import secrets
import smtplib
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime
from email.message import EmailMessage
from urllib.request import Request, urlopen

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from digest import build_digest, format_digest

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cirp")

BASE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(BASE, "docs")
DB = os.getenv("DATABASE_PATH", os.path.join(BASE, "tracker.db"))
API_KEY = os.getenv("API_KEY", "")
MAX_STATE_BYTES = 1_000_000
scheduler = BackgroundScheduler(timezone=os.getenv("TZ", "Asia/Kolkata"))


def db():
    parent = os.path.dirname(DB)
    if parent:
        os.makedirs(parent, exist_ok=True)
    con = sqlite3.connect(DB, timeout=15, isolation_level=None)  # autocommit; we open transactions explicitly
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = db()
    try:
        con.execute("CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0, updated_at TEXT)")
        con.execute("CREATE TABLE IF NOT EXISTS source_checks(url TEXT PRIMARY KEY, digest TEXT, checked_at TEXT)")
    finally:
        con.close()


def require_key(x_api_key: str | None = Header(default=None)):
    if API_KEY and not secrets.compare_digest((x_api_key or "").encode(), API_KEY.encode()):
        raise HTTPException(401, "Invalid or missing access key")


class StateIn(BaseModel):
    base_rev: int
    state: dict


def read_state(con):
    row = con.execute("SELECT value, rev, updated_at FROM kv WHERE key='state'").fetchone()
    if not row:
        return {"rev": 0, "updated_at": None, "state": {}}
    return {"rev": row["rev"], "updated_at": row["updated_at"], "state": json.loads(row["value"])}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if not scheduler.running:
        scheduler.add_job(digest_job, "interval", hours=1, id="digest", replace_existing=True)
        scheduler.add_job(monitor_sources, "interval", hours=12, id="source_monitor", replace_existing=True)
        scheduler.start()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(title="CIRP Compliance Tracker API", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat(timespec="seconds")}


@app.get("/api/state", dependencies=[Depends(require_key)])
def get_state():
    con = db()
    try:
        return read_state(con)
    finally:
        con.close()


@app.put("/api/state", dependencies=[Depends(require_key)])
def put_state(body: StateIn):
    payload = json.dumps(body.state, separators=(",", ":"))
    if len(payload.encode()) > MAX_STATE_BYTES:
        raise HTTPException(413, "State too large")
    con = db()
    try:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT rev FROM kv WHERE key='state'").fetchone()
        cur = row["rev"] if row else 0
        if body.base_rev != cur:
            con.execute("ROLLBACK")
            raise HTTPException(409, f"Stale revision (server is at {cur})")
        new = cur + 1
        con.execute(
            "INSERT INTO kv(key,value,rev,updated_at) VALUES('state',?,?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, rev=excluded.rev, updated_at=excluded.updated_at",
            (payload, new, datetime.now().isoformat(timespec="seconds")),
        )
        con.execute("COMMIT")
        return {"rev": new}
    except HTTPException:
        raise
    except Exception:
        try:
            con.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        con.close()


# ---------------------------------------------------------------- email
def send_email(subject, body):
    host, user, password, recipient = (os.getenv(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "ALERT_EMAIL"))
    if not all([host, user, password, recipient]):
        log.warning("Email not configured; skipped: %s", subject)
        return False
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, os.getenv("SMTP_FROM", user), recipient
    msg.set_content(body)
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as s:
        s.starttls()
        s.login(user, password)
        s.send_message(msg)
    return True


def digest_job():
    """At most one digest per day, sent once the local hour reaches DIGEST_HOUR (default 9)."""
    now = datetime.now()
    if now.hour < int(os.getenv("DIGEST_HOUR", "9")):
        return
    con = db()
    try:
        st = read_state(con)["state"]
        marker = now.date().isoformat()
        last = con.execute("SELECT value FROM kv WHERE key='last_digest'").fetchone()
        if last and last["value"] == marker:
            return
        overdue, upcoming = build_digest(st.get("tasks"), now.date(), int(os.getenv("REMINDER_LEAD_DAYS", "3")))
        if not overdue and not upcoming:
            return
        subject, body = format_digest(st.get("case"), overdue, upcoming, now.date())
        if send_email(subject, body):
            con.execute("INSERT INTO kv(key,value,rev,updated_at) VALUES('last_digest',?,0,?) "
                        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", (marker, now.isoformat(timespec="seconds")))
    except Exception as e:  # never let the scheduler thread die
        log.warning("Digest job failed: %s", e)
    finally:
        con.close()


def monitor_sources():
    """Optional: hash the pages listed in OFFICIAL_SOURCE_URLS and email when one changes. Never edits any date."""
    urls = [x.strip() for x in os.getenv("OFFICIAL_SOURCE_URLS", "").split(",") if x.strip()]
    for url in urls:
        try:
            req = Request(url, headers={"User-Agent": "CIRP-Compliance-Tracker/3.0 (change monitor)"})
            with urlopen(req, timeout=20) as r:
                content = r.read(2_000_000)
            digest = hashlib.sha256(content).hexdigest()
            con = db()
            try:
                old = con.execute("SELECT digest FROM source_checks WHERE url=?", (url,)).fetchone()
                con.execute("INSERT INTO source_checks(url,digest,checked_at) VALUES(?,?,?) "
                            "ON CONFLICT(url) DO UPDATE SET digest=excluded.digest, checked_at=excluded.checked_at",
                            (url, digest, datetime.now().isoformat(timespec="seconds")))
            finally:
                con.close()
            if old and old["digest"] != digest:
                send_email("Official compliance source changed",
                           f"The content at this configured source has changed:\n{url}\n\nReview it manually. No deadlines were changed automatically.")
        except Exception as e:
            log.warning("Source check failed for %s: %s", url, e)


# Static site last, so the API routes above take precedence.
app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
