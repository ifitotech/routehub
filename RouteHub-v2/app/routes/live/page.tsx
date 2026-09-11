import {redirect} from 'next/navigation'

// Direct entry point into the dispatch map, skipping the list view.
export default function LiveRouteRedirect() {
  redirect('/routes?pane=map')
}
