# v15 - cleanup and corrections of v14

## Bugs that broke the app
* **Dates never saved.** The date validator used a mis-escaped regex, so every "Date performed" and every date in the Add/Edit form was silently discarded. Fixed and unit-tested.
* **Dependent dates never appeared.** Event-based rows (verification, CoC report, first CoC meeting, valuers, IM, EoI chain …) had no way to get a date. They are now calculated from the linked step (projected, then actual).
* **Sync could erase your progress.** The old sync pushed local data, then overwrote local status with the server's defaults and froze every calculated date as "manual". Replaced by revision-checked sync with a conflict prompt.
* **Overdue reminders were never sent** (the server skipped anything past due). Now a daily digest includes overdue and upcoming steps.
* `index.html` was missing from the backend folder, so `GET /` on Render would have failed. One service now serves site + API.
* Calendar export wrote invalid `DTSTAMP` values; reminders used stale dates; alerts ignored linked dates. Fixed.
* Stray duplicated footer text, a toast hidden under the 3D hero, no responsive layout (the mobile media queries were gone), missing styles for overdue/completed rows. Fixed.
* Server data lived in `/tmp` with no protection and open CORS. Now: optional `API_KEY`, restrictable CORS, documented persistence.
* Removing a built-in milestone now persists; commencement date, case name and lead time are remembered.

## Legal register corrections (checked against IBBI orders, the IBBI model timeline and 2026 amendment notes)
* **Reg 13(1)**: claims are verified within 7 days of the *last date for receipt of claims* (T+21), not "7 days from each claim".
* **Reg 36A(1)**: Form G outer limit is **T+75** (the old "T+60" was a planning figure); sub-regulation cites fixed to 36A(3)(b), (10), (11), (12).
* **Reg 36B(1)**: RFRP/IM/evaluation matrix are issued within 5 days of the **provisional** list (the old row keyed it to the final list).
* Added outer limits for Reg 27 (T+47), Reg 36 (T+54) and plan filing under Reg 39(4) (T+165); added concrete day-counts for the EoI chain.
* New rows from the **Third Amendment Regulations, 2026** (in force 3 June 2026): Reg 13(1A) communication of claim decisions, Reg 30A withdrawal timing, Regs 28A-28B guarantor assets.
* Kept as-is, but please verify yourself: the June 2026 circular (Forms GA/H), Reg 12(2) late-claims limit, and the "model assumption" rows (30-day plan period, T+40, T+90).

## Not done / not verifiable here
* The Python backend could not be executed in this environment (no FastAPI available); only syntax and the pure reminder logic were tested. Test the first Render deploy.
* The 3D hero needs WebGL + the jsDelivr CDN, which were unavailable for testing. The module passes a syntax check; the rest of the site works without it.
