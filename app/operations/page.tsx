import {redirect} from 'next/navigation'
export const metadata={manifest:'/operations-manifest.json',title:'RouteHub Operations'}
export default function OperationsApp(){redirect('/manager')}
