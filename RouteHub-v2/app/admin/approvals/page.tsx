import {redirect} from 'next/navigation'

// Approvals merged into Billing: trial requests and manual access approval
// are really the same concern as plan/subscription status, and the old
// "Approve a Manager manually" form here inserted a row with no company_id
// - which the real access check never matches - so it didn't actually grant
// anyone anything. Kept as a redirect for old links.
export default function ApprovalsRedirect() {
  redirect('/admin/billing')
}
