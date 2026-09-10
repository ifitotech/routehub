# RouteHub — handoff for ChatGPT
Updated: 10 Sep 2026 15:30 EDT. Founder: Fito.

**Do not undo Grok work. Do not invent ETA/fake GPS. Do not touch Driver. Do not redesign Add Route.**

Live: https://routehub-wisu.vercel.app · repo ifitotech/routehub main · app RouteHub-v2/

## Preference changes already on main (do not reopen)
- Routes + OperationsMap fused on `/routes`. Map tab gone. `/routes/live` → `/routes`.
- Manage is a same-page toggle (`/routes?manage=1`). `/routes/manage` redirects there.
- In Manage only: Subir / Bajar / Cancelar via `reorder_route_queue`. Active/completed not movable.
- Tomorrow stays in the list, not drawn on the map (`3395c23f`).
- Add Route visual is approved. PO = `order_number`, Pickup only.
- Driver `/driver` → driver-v3. Do not edit it.

## Manager IA 10 Sep (authorized)
- Desktop sidebar: Hoy · Rutas · Contactos · Más.
- Mobile: Hoy · Rutas · + · Más.
- `/manager/more` grouped: Operación (Camión, Historial, Reportes) · Empresa (Equipo, Invitaciones, Sucursales, Contactos) · Cuenta (Settings).
- Hoy is a summary (counts + GPS line + status + short list + issues). No second map. Links to `/routes`.
- `/operations` → `/routes`.
- History = past stops. Reports = counts. Both under Más.
- Settings compact (Driver-style rows) is NEXT, not done.

## Files this pass
- `app/manager/manager-shell.tsx`
- `app/manager/more/page.tsx` + `more.module.css`
- `app/manager/page.tsx` (Today UI; geocode load kept)
- `app/operations/page.tsx`
