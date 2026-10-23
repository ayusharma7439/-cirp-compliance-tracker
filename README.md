# CIRP Compliance Tracker

A responsive browser dashboard with a FastAPI service. It tracks the model CIRP timeline from a configurable insolvency commencement date, status, local backups, calendar export, browser reminders and optional API sync.

## Deploy
1. Upload the root files to a GitHub repository.
2. In Render, create a Web Service from that repository (or use the Blueprint). Review current hosting/storage pricing and limitations before deployment.
3. The free configuration stores SQLite data under `/tmp`, which can be ephemeral on redeploy/restart. For durable shared data, configure persistent storage or a managed database and update `DATABASE_PATH`.
4. Set SMTP credentials as Render environment secrets only if email reminders are required. Never commit real credentials.
5. Open the Render service URL; the dashboard is served at `/`.

## Buttons
- Enable alerts requests browser notification permission. Browser notifications generally require the page to remain open and may be limited by Android/browser settings.
- Export calendar downloads an `.ics` file for calendar import.
- Add milestone, Edit, Delete, status dropdowns, filters, search, backup, restore, reset and Sync online are active.
- Sync online uses the service base URL, not `/api/updates`; the app appends the endpoint.

## Dates and legal caution
The included milestone dates reflect a model timeline, using the current IBBI CIRP Regulations available from IBBI as of 9 June 2026 and the standard 180-day model table where relevant. Asterisked dates are assumptions based on a typical sequence (e.g. an EoI/RFRP issued on the model date), not independent statutory dates. Event-based dates must be confirmed from the actual case. Check the current IBC, applicable regulations, amendments, exclusions, circulars and NCLT orders before use. This tracker is not legal advice and does not automatically interpret law changes.


## Amendment review (09 June 2026)
The default milestone register is refreshed to remove stale 2024 completion dates and stale phase labels. It adds conditional compliance checkpoints for Regulations 16E and 31B, the amended Regulation 39(3) evaluation rationale, Form GA under Regulation 39(3C), Form H under Regulation 39(4), and ongoing CIRP reporting. The API refreshes milestone descriptions and inserts newly added milestone IDs on startup while preserving user-entered status and target dates.

Official references: https://ibbi.gov.in/search/index/legalframework ; https://ibbi.gov.in/uploads/legalframwork/9ff2e33e257d8f22ab3dc142ccce6e29.pdf ; https://ibbi.gov.in/uploads/legalframwork/88150a99fe117c4b9dc4150cdc08c289.pdf

Important: The milestone descriptions are an operational review aid, not a legal opinion. Event-driven deadlines must be calculated from the actual event. Verify the consolidated regulations, amendments, circulars, effective/transition provisions and NCLT orders before filing.
