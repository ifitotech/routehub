# RouteHub Dispatch Layout Redesign
Adapting Connect's dispatch UI to RouteHub's logistics and visual system.

**Status**: Proposal  
**Version**: 1.0  
**Date**: 11 Sep 2026

---

## Current Structure

**Manager `/routes` (routes-screen.tsx):**
- Header (eyebrow + title + action buttons)
- Operation Summary (4 KPI cards: In Progress, Pending, Issues, Drivers)
- Date Tabs (Today / Tomorrow / Upcoming)
- Workspace (List pane + Map pane)
  - List: RouteRows grouped by status sections (In Progress → Scheduled → Completed)
  - Map: RoutesBoard with CompactMap
- Mobile: List/Map toggle

**Driver Dispatch (`/driver-v3/driving-day`):**
- Queue-based UI (upcoming stops)
- Navigation view for active route
- Pod (proof of delivery) panel

---

## Connect Layout (Inspiration)

```
[Calendar Week Header: MON TUE WED THU FRI SAT SUN]
                                          [Search] [Import] [New]

[Sidebar]              [Main Content]              [Map]
- Unassigned (0)       BOX TRUCK  Active  ↔  [Filter] [Route Style]
- Complete (0)         0/20 capacity
- Canceled (0)         No deliveries assigned
                       "Load Saved Route" button

                       DISPATCH VEHICLE
                       Sent to Dispatch
                       No deliveries assigned
```

---

## Proposed RouteHub Dispatch Layout

### 1. Top Navigation Bar
```
[Calendar: MON TUE WED THU FRI... ←  →]  [Search] [Import] [+ New Route] [Filter] [View: List/Map]
```
- Week view (7 days) with quick date selection
- Always visible
- Quick actions on right (Import, New, Filter toggle)

### 2. Three-Column Layout (Desktop)

**LEFT: Route Status Sidebar**
```
Unassigned (n)
├─ [Route card]
└─ [Route card]

In Progress (n)
├─ [Active route with driver name]
└─ [Active route]

Pending (n)
├─ [Scheduled route]
└─ [Scheduled route]

Completed (n)
├─ [Completed route]
└─ [Completed route]

Issues (n)
├─ [Issue route]
```

**CENTER: Route Details & Actions**
```
VEHICLE / DRIVER SELECTOR
[Truck Icon] BOX TRUCK    [Driver: Select ▼]    [Active toggle]
Capacity: 12/20 packages  Distance: 42 mi  ETA: 2:45 PM

ROUTE QUEUE for selected vehicle
Route 1: Pickup at [Address] — Order #PO-001
Route 2: Delivery at [Address] — Order #PO-002
Route 3: Return to Branch

[Plan Route] [Reorder Routes] [Print Route]
```

**RIGHT: Map (Sticky)**
```
[Map showing all routes for selected day]
[Zoom controls]
[Legend]
```

### 3. Mobile Layout
```
[Week Calendar] ← Scrollable
[Vehicle Selector & Capacity]
[Route List] ← Scrollable
[Map] (can expand fullscreen via pull-to-refresh pattern)
```

---

## Key Changes vs. Current

| Current | Proposed |
|---------|----------|
| Date tabs (Today/Tomorrow/Upcoming) | Week calendar (7-day view) |
| KPI summary cards | Sidebar with status sections |
| Separate List/Map toggle | 3-column layout (always shows both) |
| RouteRows flat list | Hierarchical: Vehicle → Route Queue |
| Manual layout switching | Context-aware (select vehicle → see its routes) |

---

## Alignment with RouteHub

**Kept (do not change):**
- Navy `#0B1F3A` + Electric Blue `#1660F0` + White palette
- Light-mode only
- CompactMap component (reuse for right panel)
- i18n (EN/ES/FR)
- Pull-to-refresh with truck animation
- Route workflow (draft → published → active → completed)

**New:**
- Week calendar navigation
- Vehicle-centric dispatch (select truck → see its stops)
- Sidebar state organization (Unassigned / In Progress / Pending / Completed / Issues)
- 3-column responsive grid

---

## Implementation Phases

### Phase 1: Desktop Foundation
- [ ] Week calendar component
- [ ] Left sidebar (status sections)
- [ ] Center vehicle selector + queue
- [ ] Right map (sticky)
- [ ] 3-column grid layout

### Phase 2: Mobile Adaptation
- [ ] Stacked layout (calendar → vehicle → queue → map)
- [ ] Pull-to-refresh on map (already done)
- [ ] Collapsible sections

### Phase 3: Interactions
- [ ] Click route → highlight on map
- [ ] Drag route to reorder (within vehicle queue)
- [ ] Select vehicle → filter routes
- [ ] Manage toggle (Suir/Bajar/Cancelar)

### Phase 4: Driver Integration
- If adapting to Driver app too, similar calendar + queue structure
- But Driver always sees **active route**, not dispatcher view

---

## Files to Create/Modify

**New Components:**
- `DispatchCalendar.tsx` — Week view with date selection
- `StatusSidebar.tsx` — Route grouping by status
- `VehicleSelector.tsx` — Truck + driver + capacity
- `DispatchLayout.tsx` — 3-column grid wrapper

**Modify:**
- `routes-screen.tsx` — Import new components, restructure
- `routes.module.css` — New grid layout
- `routes-board.tsx` — Sidebar context instead of workspace toggle

**Optional Reuse:**
- `CompactMap` — Right panel map
- `RouteRows` — Status sidebar items (but styled differently)

---

## Questions & Decisions

1. **Week vs. Calendar Month?** Connect uses week. Propose week (more compact, quicker nav).
2. **Vehicle selector in center or top?** Connect puts it in cards. Propose top (always visible context).
3. **Manage mode (Suir/Bajar)?** Keep it as toggle, hides details → shows reorder UI?
4. **Mobile priority?** Should sidebar collapse? Can we keep 3-column or go stacked?
5. **Driver app?** Adapt same layout for `/driver-v3/driving-day` or keep queue-based?

---

## Timeline Estimate

- **Phase 1 (Desktop)**: ~4-6 hours (calendar + layout + basic wiring)
- **Phase 2 (Mobile)**: ~2-3 hours (responsive stacking)
- **Phase 3 (Interactions)**: ~3-4 hours (drag/reorder, map highlighting)
- **Phase 4 (Driver)**: ~2-3 hours (if applicable)

**Total**: 11-16 hours (2-3 days)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking manage mode | Keep toggle intact, hide/show details |
| Map integration | Reuse CompactMap, test sticky positioning |
| Mobile responsiveness | Build mobile-first in Phase 2 |
| Drag/drop reorder | Use existing `moveRoute` logic, add UI |

---

## Approval & Next Steps

- [ ] Review this proposal
- [ ] Decide: Start Phase 1 now or defer?
- [ ] Clarify decisions (week vs. month, vehicle selector placement, etc.)
- [ ] Lock mobile strategy (stacked vs. hybrid)
