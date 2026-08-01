import type {Metadata} from 'next'
export const metadata:Metadata={manifest:'/manager-manifest.json'}
export default function ManagerLayout({children}:{children:React.ReactNode}){return children}
