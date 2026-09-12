import {redirect} from 'next/navigation'

// Reports merged into Manager > History as an "Overview" tab (they read
// almost the same routes table with almost the same period/driver filters).
// This route stays as a redirect so old links and bookmarks still land
// somewhere useful instead of 404ing.
export default function ReportsRedirect() {
  redirect('/manager/history?tab=overview')
}
