# CIRP Compliance Command Centre — online deployment starter

## Included
- `index.html`: responsive dashboard and browser-side editing/filtering/calendar export.
- `app.py`: FastAPI API, SQLite persistence, scheduled email reminders and configured source-page change monitoring.
- `tasks_seed.json`: 24 milestones imported from the supplied workbook.
- `render.yaml`: deployment blueprint for Render.
- `.env.example`: email/source-monitor configuration template.

## Important limitations
This package is ready to deploy, but it is **not already hosted online**. You must deploy it to a hosting account and configure a mail provider. No credentials are included.
The source monitor only detects a configured official page's content changing. It does not determine the legal meaning of an amendment or automatically rewrite filing dates. Regulatory changes should be reviewed and approved by a qualified professional before the tracker is changed.
Dates expressed as T+N are calculated in the dashboard from the commencement date. Dates based on dependencies (e.g. “within 7 days of CoC meeting”) need case-specific dates and should be entered manually. Do not treat the sample workbook's dates as legal advice; verify current IBC/IBBI regulations, amendments, tribunal orders, and case facts.

## Deploy to Render (simple route)
1. Create a private GitHub repository and upload the files in this folder.
2. In Render, choose **New → Blueprint** and connect the repository; Render reads `render.yaml`.
3. If your plan does not support a persistent disk or background worker, choose a plan that does. Keep the persistent disk mounted at `/var/data` so SQLite survives restarts.
4. In the Render service's Environment settings, add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `ALERT_EMAIL`. Use an app password or transactional email provider; never commit secrets to GitHub.
5. Set `OFFICIAL_SOURCE_URLS` to a comma-separated list of authoritative pages or RSS feeds you want to monitor. Start with official IBBI and MCA sources that are relevant to your practice. Do not use pages unless their terms and access rules permit monitoring.
6. Deploy, open your service URL, then check `/health` and `/api/updates`.
7. Test email reminders with a non-critical test milestone before relying on it for deadlines.

## API
- `GET /health` — health check
- `GET /api/updates` — returns `{"updates":[...]}` for the dashboard's Sync online button
- `POST /api/updates` — accepts a JSON array of objects with `id` and optional `target`, `title`, `rule`, `status`
- `POST /api/seed` — seeds the database if empty (startup also seeds automatically)

Example:
```json
[
  {"id": 23, "target": "2026-11-01", "status": "In Progress"}
]
```

## Notifications
The scheduler checks email reminders every six hours and sends one reminder per task per day when due within `REMINDER_LEAD_DAYS`, including overdue tasks. It checks configured source pages every 12 hours and emails if their content changes. For production use, protect write endpoints with authentication, restrict CORS, use managed PostgreSQL, and consider a dedicated scheduler/worker to avoid duplicate jobs if running multiple instances.

## Calendar
Use **Export calendar** in the dashboard, then import the `.ics` file into Google Calendar or Outlook. The calendar provider can deliver notifications even when the dashboard is closed.
