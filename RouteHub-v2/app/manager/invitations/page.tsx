import {redirect} from 'next/navigation'

// Invitations merged into Team: the invite form and the pending/revoked
// list now live in one place instead of two pages duplicating the same
// form. Kept as a redirect so old links (Settings bookmarks, the
// notification bell's "view invitation" link) still land somewhere useful.
export default function InvitationsRedirect() {
  redirect('/manager/team')
}
