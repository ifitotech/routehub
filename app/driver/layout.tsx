import type {Metadata} from 'next'
export const metadata:Metadata={manifest:'/driver-manifest.json',icons:{icon:'/icon-192.svg',apple:'/icon-192.svg'}}
export default function DriverLayout({children}:{children:React.ReactNode}){return children}
