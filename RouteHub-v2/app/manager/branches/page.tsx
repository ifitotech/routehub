import {redirect} from 'next/navigation'

// The primary branch is configured in Settings. Keep old saved links working
// without maintaining a second branch editor.
export default function BranchesRedirect() {
  redirect('/settings')
}
