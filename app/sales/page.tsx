import {redirect} from 'next/navigation'
export const metadata={manifest:'/sales-manifest.json',title:'RouteHub Sales'}
export default function SalesApp(){redirect('/counter')}
