# RouteHub handoff 2026-09-03

## Add Route desktop (dictated)
Visible without scroll: type, driver, date|time same row, location package, deliver-to. Pickup also shows PO on the main screen. More details is optional only (position, save contact, job number on delivery, phone, notes). Map stays on the right.
Workspace form: RouteHub-v2/app/routes/page.tsx
Desktop CSS already on main (add-route-desktop.css + routes/layout.tsx).

## Reschedule Issue
Manage routes issue cards have Reagendar. Same route id: status published, new route_date + scheduled_at, clocks cleared, appended to that day queue, push assigned. Address/PO/driver kept. Do not invent a second stop.
File: RouteHub-v2/app/routes/manage/page.tsx

Do not push workspace driver 97k split. GitHub origin/main is source of truth.
