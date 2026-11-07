"""Pure reminder logic (no web framework imports) so it can be unit-tested."""
from datetime import date


def parse_iso(s):
    try:
        return date.fromisoformat(s) if s else None
    except (TypeError, ValueError):
        return None


def build_digest(tasks, today, lead):
    """Return (overdue, upcoming) lists of (days, task) for open tasks that are overdue or due within `lead` days.

    Completed and On Hold tasks are skipped. Overdue means due date before `today`.
    """
    overdue, upcoming = [], []
    for t in tasks or []:
        if not isinstance(t, dict) or t.get("status") in ("Completed", "On Hold"):
            continue
        due = parse_iso(t.get("due"))
        if not due:
            continue
        days = (due - today).days
        if days < 0:
            overdue.append((days, t))
        elif days <= lead:
            upcoming.append((days, t))
    overdue.sort(key=lambda x: x[0])
    upcoming.sort(key=lambda x: x[0])
    return overdue, upcoming


def format_digest(case, overdue, upcoming, today):
    lines = [f"CIRP compliance digest for {case or 'your case'} - {today.strftime('%d %b %Y')}", ""]
    if overdue:
        lines.append(f"OVERDUE ({len(overdue)})")
        for days, t in overdue:
            lines.append(f"  - {t.get('title')} [{t.get('rule', '')}] was due {t.get('due')} ({abs(days)} day(s) late)")
        lines.append("")
    if upcoming:
        lines.append(f"DUE SOON ({len(upcoming)})")
        for days, t in upcoming:
            when = "TODAY" if days == 0 else f"in {days} day(s)"
            lines.append(f"  - {t.get('title')} [{t.get('rule', '')}] due {t.get('due')} ({when})")
        lines.append("")
    lines.append("Please verify each deadline against current law, amendments and case-specific orders.")
    lines.append("This is an automated operational reminder, not legal advice.")
    subject = (f"{len(overdue)} overdue, " if overdue else "") + f"{len(upcoming)} due soon - CIRP tracker"
    return subject, "\n".join(lines)
