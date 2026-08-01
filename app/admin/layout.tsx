import type {Metadata} from 'next'
export const metadata:Metadata={manifest:'/admin-manifest.json',icons:{icon:'/icon-routehub-192.svg',apple:'/icon-routehub-192.svg'}}
export default function AdminLayout({children}:{children:React.ReactNode}){return children}
