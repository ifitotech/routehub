import type {Metadata} from 'next'
import DriverSessionGate from './driver-session-gate'

export const metadata:Metadata={
  title:'RouteHub Driver',
  manifest:'/manifest-driver.json',
  appleWebApp:{capable:true,title:'RouteHub Driver',statusBarStyle:'default'},
  icons:{icon:'/routehub-driver-icon.png?v=20',apple:'/routehub-driver-icon.png?v=20'},
}

export default function DriverLayout({children}:{children:React.ReactNode}){
  return <DriverSessionGate>{children}</DriverSessionGate>
}
