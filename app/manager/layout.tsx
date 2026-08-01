import type {Metadata} from 'next'
export const metadata:Metadata={manifest:'/manager-manifest.json',icons:{icon:'/routehub-logo.png',apple:'/routehub-logo.png'}}
export default function ManagerLayout({children}:{children:React.ReactNode}){return children}
