import os, json, sqlite3, hashlib, smtplib, logging
from email.message import EmailMessage
from datetime import date, datetime, timedelta
from urllib.request import Request, urlopen
from urllib.error import URLError
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler

logging.basicConfig(level=logging.INFO)
BASE=os.path.dirname(os.path.abspath(__file__))
DB=os.getenv("DATABASE_PATH", os.path.join(BASE,"tracker.db"))
app=FastAPI(title="CIRP Compliance Tracker API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS","*").split(","), allow_methods=["*"], allow_headers=["*"])
scheduler=BackgroundScheduler(timezone=os.getenv("TZ","Asia/Kolkata"))

class TaskUpdate(BaseModel):
    id: int
    target: str|None=None
    title: str|None=None
    rule: str|None=None
    status: str|None=None

def db():
    con=sqlite3.connect(DB)
    con.row_factory=sqlite3.Row
    return con

def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS tasks(
        id INTEGER PRIMARY KEY, title TEXT NOT NULL, rule TEXT, phase TEXT, mandate TEXT,
        timeline TEXT, target TEXT, actual TEXT, status TEXT DEFAULT 'Pending', reminder_sent TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS source_checks(url TEXT PRIMARY KEY, digest TEXT, checked_at TEXT)""")

@app.get("/")
def home():
    return FileResponse(os.path.join(BASE,"index.html"))

@app.get("/health")
def health():
    return {"status":"ok","time":datetime.now().isoformat(timespec="seconds")}

@app.get("/api/updates")
def get_updates():
    with db() as c:
        rows=c.execute("SELECT id,title,rule,target,status FROM tasks ORDER BY id").fetchall()
    return {"updates":[dict(r) for r in rows]}

@app.post("/api/updates")
def update_tasks(updates: list[TaskUpdate]):
    changed=0
    with db() as c:
        for u in updates:
            fields=[]; values=[]
            for k in ("target","title","rule","status"):
                v=getattr(u,k)
                if v is not None:
                    # Targets may be ISO dates, blank, or event-based text such as "Upon AA Approval".
                    # Keep the API permissive; date calculations are handled by the dashboard.
                    fields.append(f"{k}=?"); values.append(v)
            if fields:
                values.append(u.id)
                cur=c.execute(f"UPDATE tasks SET {','.join(fields)} WHERE id=?",values)
                changed+=cur.rowcount
    return {"updated":changed}

@app.post("/api/seed")
def seed_tasks():
    # Use only on first deployment; this restores the 24 milestones included with the workbook.
    data=json.load(open(os.path.join(BASE,"tasks_seed.json"),encoding="utf-8"))
    with db() as c:
        count=c.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        if count: return {"seeded":False,"reason":"tasks table already contains data","count":count}
        for t in data:
            c.execute("""INSERT INTO tasks(id,title,rule,phase,mandate,timeline,target,actual,status)
            VALUES(?,?,?,?,?,?,?,?,?)""",(t["id"],t["title"],t["rule"],t["phase"],t["mandate"],t["timeline"],t.get("target") or None,t.get("actual") or None,t.get("status","Pending")))
    return {"seeded":True,"count":len(data)}

def send_email(subject, body):
    host=os.getenv("SMTP_HOST"); user=os.getenv("SMTP_USER"); password=os.getenv("SMTP_PASSWORD")
    recipient=os.getenv("ALERT_EMAIL")
    if not all([host,user,password,recipient]):
        logging.warning("Email not configured; reminder skipped: %s",subject); return False
    msg=EmailMessage(); msg["Subject"]=subject; msg["From"]=os.getenv("SMTP_FROM",user); msg["To"]=recipient; msg.set_content(body)
    with smtplib.SMTP(host,int(os.getenv("SMTP_PORT","587")),timeout=20) as s:
        s.starttls(); s.login(user,password); s.send_message(msg)
    return True

def reminder_job():
    lead=int(os.getenv("REMINDER_LEAD_DAYS","3")); today=date.today()
    with db() as c:
        rows=c.execute("SELECT * FROM tasks WHERE target IS NOT NULL AND target!='' AND status!='Completed'").fetchall()
        for row in rows:
            try: due=date.fromisoformat(row["target"])
            except ValueError: continue
            days=(due-today).days
            if days<0 or days>lead: continue
            marker=f"{today.isoformat()}:{row['target']}"
            if row["reminder_sent"]==marker: continue
            subject=("OVERDUE" if days<0 else "DUE TODAY" if days==0 else f"Due in {days} day(s)")+": "+row["title"]
            body=f"""CIRP compliance reminder

Milestone: {row['title']}
Reference: {row['rule']}
Target date: {row['target']}
Status: {row['status']}
Days remaining: {days}

Please verify the deadline against current law, amendments and case-specific orders.
This is an automated operational reminder, not legal advice."""
            if send_email(subject,body):
                c.execute("UPDATE tasks SET reminder_sent=? WHERE id=?",(marker,row["id"]))

def monitor_sources():
    # Poll only URLs explicitly configured in OFFICIAL_SOURCE_URLS (comma-separated).
    # This detects page changes; it does NOT interpret law or alter dates automatically.
    urls=[x.strip() for x in os.getenv("OFFICIAL_SOURCE_URLS","").split(",") if x.strip()]
    for url in urls:
        try:
            req=Request(url,headers={"User-Agent":"CIRP-Compliance-Tracker/1.0 (official-source change monitor)"})
            with urlopen(req,timeout=20) as r: content=r.read(2_000_000)
            digest=hashlib.sha256(content).hexdigest()
            with db() as c:
                old=c.execute("SELECT digest FROM source_checks WHERE url=?",(url,)).fetchone()
                c.execute("INSERT INTO source_checks(url,digest,checked_at) VALUES(?,?,?) ON CONFLICT(url) DO UPDATE SET digest=excluded.digest, checked_at=excluded.checked_at",(url,digest,datetime.now().isoformat(timespec="seconds")))
            if old and old["digest"]!=digest:
                send_email("Official compliance source changed",f"The content at this configured source has changed:\n{url}\n\nReview the official publication manually. No deadlines were changed automatically.")
        except Exception as e:
            logging.warning("Source check failed for %s: %s",url,e)

@app.on_event("startup")
def startup():
    init_db()
    # Seed only if table empty. Seed dates are blank when no target date was entered in source workbook;
    # the dashboard calculates T+N dates client-side from the commencement date.
    try: seed_tasks()
    except Exception as e: logging.warning("Seed skipped: %s",e)
    if not scheduler.running:
        scheduler.add_job(reminder_job,"interval",hours=6,id="reminders",replace_existing=True)
        scheduler.add_job(monitor_sources,"interval",hours=12,id="source_monitor",replace_existing=True)
        scheduler.start()

@app.on_event("shutdown")
def shutdown():
    if scheduler.running: scheduler.shutdown()
