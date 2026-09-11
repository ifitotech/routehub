import {redirect} from 'next/navigation'

// Today and Routes showed overlapping route data on two separate screens.
// They're merged into one Dashboard at /routes (see routes-screen.tsx).
export default function ManagerTodayRedirect() {
  redirect('/routes')
}
