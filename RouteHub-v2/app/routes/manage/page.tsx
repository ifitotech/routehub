import {redirect} from 'next/navigation'

export default function ManageRoutesRedirect() {
  redirect('/routes?manage=1')
}
