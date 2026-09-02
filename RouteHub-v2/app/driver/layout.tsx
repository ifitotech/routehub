import type {Metadata} from 'next'
import DriverSessionGate from './driver-session-gate'

export const metadata:Metadata={
  title:'RouteHub Driver',
  manifest:'/manifest-driver.json',
  appleWebApp:{capable:true,title:'RouteHub Driver',statusBarStyle:'default'},
  icons:{icon:'/routehub-driver-new.jpg',apple:'/routehub-driver-new.jpg'},
}

export default function DriverLayout({children}:{children:React.ReactNode}){
  return <DriverSessionGate>{children}</DriverSessionGate>
}
