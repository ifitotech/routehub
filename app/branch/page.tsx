import {redirect} from 'next/navigation'
export const metadata={manifest:'/branch-manifest.json',title:'RouteHub Branch Manager'}
export default function BranchApp(){redirect('/manager')}
