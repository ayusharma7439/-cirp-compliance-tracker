# CIRP Compliance Command Centre

A personal tracker for Corporate Insolvency Resolution Process (IBC) milestones: model timeline, performed-date
tracking, linked-step date calculation, calendar export, optional email digest and multi-device sync.

```
app.py            FastAPI server: serves ./docs and a small state API (GET/PUT /api/state, /health)
digest.py         reminder logic (unit-tested)
docs/             the website  (index.html, styles.css, app.js, logic.js, hero3d.js, tasks_seed.json)
tools/            tests + optional Blender script for an authored 3D hero
render.yaml       Render Blueprint
```

## Deploy: GitHub + Render (one service does everything)

1. **GitHub**: create an empty *private* repository, then from this folder:
   ```
   git init && git add . && git commit -m "CIRP tracker"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. **Render**: Dashboard → **New → Blueprint** → pick the repo → **Apply**. Leave the SMTP/ALERT_EMAIL prompts blank if you don't want email.
3. Open the `https://<name>.onrender.com` URL. The site detects the server by itself.
4. Render generated an **API_KEY** for you: Render → your service → *Environment* → copy it → paste it in the site under
   *Backup, sync & reminders → Access key*. Without the key nobody (including you) can read or write the server copy.
5. First sync happens automatically; the status line shows the server revision.

### Things to know about the free Render plan
* **It sleeps after ~15 minutes idle** and takes up to a minute to wake. The daily email digest only runs while the service is awake.
  Keep it awake with a free uptime pinger (e.g. UptimeRobot hitting `/health` every 5 minutes) or use a paid plan.
* **Its disk is wiped on restart/redeploy.** Your data is not lost: it lives in your browser, and the site re-uploads it to the server on the next
  visit. Still use *Backup data* regularly. For a durable server copy use a paid plan + disk (see comments in `render.yaml`).

### Optional: host only the website on GitHub Pages
Settings → Pages → *Deploy from branch* → `main` / `/docs`. Then open the Pages site and type your Render URL in the *Server URL* box.
Set `CORS_ORIGINS=https://<you>.github.io` on Render so only that origin can call the API.

## Email digest (optional)
Set `ALERT_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (and `SMTP_PORT`, `SMTP_FROM` if needed). One digest per day after `DIGEST_HOUR`
(default 9, India time) lists overdue steps and steps due within `REMINDER_LEAD_DAYS` (default 3). Gmail needs an *app password*.

## How the dates work
* Enter the **commencement date (T)**. Rows with a fixed offset (T+3, T+14, T+75 …) are calculated from it.
* Rows linked to an earlier step (e.g. *Report certifying CoC = verification + 2 days*) are **projected** from the earlier step's due date,
  and switch to its **performed date** as soon as you record it.
* **Outer limits** (e.g. valuers by T+47, IM by T+54, Form G by T+75, plan filing by T+165) never move, even if an earlier step ran late.
* A **manual due date** (Edit) overrides any calculation. *Done late* flags steps performed after their due date.

## Tests
`node tools/test_logic.js` and `python tools/test_digest.py` (also run by GitHub Actions on every push).

> This is an operational aid, not legal advice. Check every date against the current regulations, circulars and NCLT orders.
