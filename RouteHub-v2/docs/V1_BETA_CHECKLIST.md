# RouteHub V1 beta checklist

This is the release gate for the first real Manager and Driver field tests. A
check only counts when it is verified on the production deployment, using the
same Supabase project and device permissions as the beta.

## Automated release gate

- [x] Route and stop workflow tests
- [x] Queue ordering, reassignment and refresh tests
- [x] Role and company/branch isolation tests
- [x] Invitation and activation contract tests
- [x] Installed-app session routing tests
- [x] First-run onboarding tests
- [x] TypeScript check
- [x] ESLint (warnings documented; no errors)
- [x] Production build

## Manager field test

- [ ] Sign in, sign out and password recovery
- [ ] Create Pickup from a saved contact and from a manual address
- [ ] Create Delivery from a saved contact and from a manual address
- [ ] Assign and reassign a route to another Driver
- [ ] Reorder pending routes without changing the active route
- [ ] Edit and cancel a pending route
- [ ] Confirm Today counts and Live Operations match the route list
- [ ] Confirm issue, evidence and completion data appear in History
- [ ] Invite a team member and activate the account from a fresh device
- [ ] Verify notifications while RouteHub is open and closed

## Driver field test — iPhone and Android

- [ ] Install RouteHub and reopen into the authenticated workspace
- [ ] Complete the three first-run slides; replay them from Settings
- [ ] Start and end a driving day
- [ ] Deny and later enable location without losing access to the app
- [ ] Receive a new assignment and a route-change push while the app is closed
- [ ] Open external Google Maps from the current stop
- [ ] Complete Pickup with and without packing-list evidence
- [ ] Complete Delivery with recipient name and optional photo/signature/note
- [ ] Complete Return to Branch in the middle and at the end of a route
- [ ] Report an issue and verify it in Manager
- [ ] Refresh/relaunch after every route state and confirm progress is restored
- [ ] Lose connectivity, queue one supported action and verify it synchronizes
- [ ] Confirm Today, Route and seven-day History show consistent information

## Required before public App Store / Google Play submission

- [ ] Public Privacy Policy linked inside RouteHub
- [ ] Terms of Service linked inside RouteHub
- [ ] In-app account-deletion request and public deletion URL
- [ ] Prominent background-location disclosure and store declarations
- [ ] Accurate Apple privacy labels and Google Play Data safety form
- [ ] Working customer-support channel (not a placeholder button)
- [ ] Crash/error monitoring with release and device information
- [ ] Reviewer demo Manager and Driver accounts with sample routes
- [ ] Store screenshots, descriptions, support URL and review notes
- [ ] Final accessibility and small/large-screen device matrix

## V1 scope boundary

RouteHub V1 already covers the operational baseline: assignment, ordered
Pickup/Delivery/Branch stops, external navigation, live driver status, proof of
delivery, issues, push infrastructure, history and role-scoped workspaces.
Optimization, predictive ETA, customer tracking links, barcode scanning,
in-app chat and advanced analytics are post-V1 enhancements unless a beta user
identifies one as essential.
