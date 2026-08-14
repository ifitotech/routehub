# RouteHub beta checklist

Use test companies and test users. Do not run destructive QA against production.

## Configuration

- [ ] `npm run check:env` passes without printing credential values.
- [ ] Required migrations are applied in the order in `MIGRATIONS.md`.
- [ ] Private route-evidence Storage policies are applied.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

## Authentication and invitations

- [ ] Manager, Primary Driver, and Team Member can sign in and reach their correct workspace.
- [ ] Manager sends an invitation with the correct company, branch, and role.
- [ ] Existing account is linked automatically; new account can claim its matching invitation.
- [ ] Accepted membership appears in Team and revoked invitation behavior is correct.
- [ ] Assignment never changes a Team Member's permanent role.

## Dashboard

- [ ] Branch name and Primary Driver are correct.
- [ ] Today includes only the selected company, branch, and `route_date`.
- [ ] Tomorrow and another branch do not change today's route metrics.
- [ ] No-routes state shows a useful Create Route action.

## Routes

- [ ] Create a Delivery and a Pickup for today.
- [ ] Primary Driver is selected by default.
- [ ] Create a Return to Branch route.
- [ ] Assign one temporary route to an authorized Team Member.
- [ ] New routes receive normalized, queue-local positions without gaps or duplicates.
- [ ] Reorder the Primary Driver queue and confirm the temporary assignee's queue is unchanged.
- [ ] Reassign an upcoming route and confirm both source and target queues normalize.
- [ ] Attempting mixed-queue or locked-route reorder fails without partial changes.

## Driver and temporary execution

- [ ] Driver sees only their assigned routes for today's `route_date`.
- [ ] Start Driving Day creates one active driving session.
- [ ] Start, pause/resume, navigate, complete with photo, and report problem work.
- [ ] Completing the current mission selects the latest authoritative next route.
- [ ] Driving Day remains active between missions and ends only when requested.
- [ ] Team Member sees their temporary assignment in their normal workspace.
- [ ] Team Member can open and execute only that assigned route.
- [ ] Temporary session ends on completion/issue/cancellation and the permanent role remains unchanged.

## Live Route and privacy

- [ ] Active Driving Day remains visible when no mission is active.
- [ ] Recent, approximate, and last-known freshness labels match update age.
- [ ] End Driving Day removes active operational visibility.
- [ ] Temporary mission location stops when that mission ends.
- [ ] Only the latest coordinate is stored; no GPS history or route replay exists.
- [ ] Permission denied or lost signal shows a truthful state without blocking unrelated work.

## Security

- [ ] Company A cannot read or update Company B routes, invitations, or sessions.
- [ ] Branch-scoped user cannot manage another unauthorized branch.
- [ ] Temporary assignee cannot execute another person's route.
- [ ] Temporary assignee cannot change company, branch, assignee, date, position, origin, or destination.

## Mobile and deployment

- [ ] iPhone Safari: no horizontal overflow, keyboard zoom, or bottom-navigation overlap.
- [ ] iPhone Home Screen PWA: refresh restores the active route from Supabase.
- [ ] Android Chrome: route execution, location permission, camera, and navigation work.
- [ ] Desktop Manager: Dashboard, Create Route, Manage Routes, History, and Live Route work.
- [ ] Vercel environment contains the documented variable names and the production build is current.

