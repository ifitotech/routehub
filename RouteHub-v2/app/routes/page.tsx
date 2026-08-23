'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  MapPin,
  PackageCheck,
  Plus,
  Route as RouteIcon,
  Search,
  SlidersHorizontal,
  Truck,
  Users,
  UserRound,
  X,
} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import {recordActivity} from '../../lib/activity'
import {chooseDefaultAssignee} from '../../lib/route-assignment'
import GoogleAddressInput, {type LocalAddressSuggestion} from '../google-address-input'
import styles from './routes.module.css'
import contrast from './route-contrast.module.css'
import LiveRoute from './live-route'

type Contact = {
  id: string
  company_name: string
  contact_name?: string | null
  address: string
  phone?: string | null
}

type DriverProfile = {email?: string | null; name?: string | null}
type Branch = {id: string; name: string; address?: string | null; primary_driver_id?: string | null}
type OriginMode = 'branch' | 'previous' | 'contact' | 'custom'
type Driver = {
  user_id: string
  role?: string
  users?: DriverProfile | DriverProfile[] | null
}

type RouteRecord = {
  id: string
  driver_id: string | null
  mission_type: string | null
  priority: string | null
  status: string | null
  origin_name: string | null
  origin_address: string | null
  destination_name: string | null
  destination_address: string | null
  scheduled_at: string | null
  route_date: string | null
  position: number | null
  notes: string | null
  order_number: string | null
}

type FormState = {
  type: 'pickup' | 'delivery' | 'transfer' | 'return'
  origin: string
  destination: string
  destination_label: string
  destination_phone: string
  contact_id: string
  priority: 'normal' | 'priority' | 'urgent'
  order_number: string
  notes: string
  date: string
  time: string
  driver_id: string
}

const originCopy = {
  en:{branch:'Default branch',previous:'Last route',contact:'Saved place',custom:'Custom',chooseBranch:'Choose branch',chooseContact:'Choose a saved contact or store',noPrevious:'No previous route is available for this driver.'},
  es:{branch:'Sucursal predeterminada',previous:'Última ruta',contact:'Lugar guardado',custom:'Personalizado',chooseBranch:'Elige una sucursal',chooseContact:'Elige un contacto o tienda guardada',noPrevious:'Este conductor no tiene una ruta anterior disponible.'},
  fr:{branch:'Succursale par défaut',previous:'Dernier itinéraire',contact:'Lieu enregistré',custom:'Personnalisé',chooseBranch:'Choisir une succursale',chooseContact:'Choisir un contact ou magasin enregistré',noPrevious:'Aucun itinéraire précédent n’est disponible pour ce conducteur.'},
}

// Issues are reviewed from the Manager dashboard and route history. Keeping
// them out of the operational list prevents an exception from being mistaken
// for a route that is still ready to dispatch.
const routeStatuses = ['draft', 'pending', 'published', 'active', 'paused']
const routeTypes: Array<{value: FormState['type']; label: string}> = [
  {value: 'pickup', label: 'Pickup'},
  {value: 'delivery', label: 'Delivery'},
]
const priorities: Array<{value: FormState['priority']; label: string}> = [
  {value: 'normal', label: 'Normal'},
  {value: 'priority', label: 'Priority'},
  {value: 'urgent', label: 'Urgent'},
]

const routeCopy = {
  en:{operations:'Route operations',title:'Routes',subtitle:'See every active assignment and publish the next route.',manage:'Manage routes',add:'Add route',assigned:'Assigned routes',assignedHelp:'Published, active and paused routes appear here.',active:'active',branch:'Branch',destinationPending:'Destination pending',noPo:'No PO',orderReference:'Order reference',viewManage:'View and manage',empty:'No active routes',emptyHelp:'Publish the first route for your team today.',newAssignment:'New assignment',create:'Create route',close:'Close route form',chooseDestination:'Choose destination',routeType:'Route type',returnToBranch:'Return to branch',returnHelp:'Sets your branch as the destination. You can still choose the starting point.',driver:'Driver',chooseDriver:'Choose driver',startingPoint:'Starting point',originPlaceholder:'Branch or starting address',contactDestination:'Contact or destination',searchPlaceholder:'Search a contact or type an address',searchHelp:'Start typing to see address suggestions, or select a saved contact.',priority:'Priority',date:'Date',time:'Time',po:'PO or order number',optional:'Optional',poExample:'Example: PO-45872',notes:'Notes',notesPlaceholder:'Delivery instructions for the driver',publish:'Publish route',publishing:'Publishing...',published:'Route published successfully.',chooseRequired:'Choose a driver and enter a destination.',workspacePending:'The company workspace is not ready. Refresh and try again.',invalidDate:'Choose a valid date and time.',loadError:'Unable to load route information.',saveError:'Unable to save route.',preview:'Route preview',previewHelp:'Choose a contact or enter an address.',openMaps:'Open in Google Maps',teamDriver:'Team driver',route:'Route',inProgress:'In progress',statusPublished:'Published',paused:'Paused',issue:'Issue',draft:'Draft',pending:'Pending',noTime:'No time set',today:'Today',normal:'Normal',priorityName:'Priority',urgent:'Urgent',pickup:'Pickup',delivery:'Delivery',transfer:'Custom route',return:'Return to branch'},
  es:{operations:'Operaciones de rutas',title:'Rutas',subtitle:'Consulta las asignaciones activas y publica la próxima ruta.',manage:'Gestionar rutas',add:'Añadir ruta',assigned:'Rutas asignadas',assignedHelp:'Aquí aparecen las rutas publicadas, activas y pausadas.',active:'activas',branch:'Sucursal',destinationPending:'Destino pendiente',noPo:'Sin PO',orderReference:'Referencia de orden',viewManage:'Ver y gestionar',empty:'No hay rutas activas',emptyHelp:'Publica la primera ruta del equipo para hoy.',newAssignment:'Nueva asignación',create:'Crear ruta',close:'Cerrar formulario',chooseDestination:'Elige un destino',routeType:'Tipo de ruta',returnToBranch:'Regresar a sucursal',returnHelp:'Usa la sucursal como destino. Aún puedes elegir el punto de salida.',driver:'Conductor',chooseDriver:'Elige un conductor',startingPoint:'Punto de salida',originPlaceholder:'Sucursal o dirección de salida',contactDestination:'Contacto o destino',searchPlaceholder:'Busca un contacto o escribe una dirección',searchHelp:'Escribe para ver sugerencias de direcciones o selecciona un contacto guardado.',priority:'Prioridad',date:'Fecha',time:'Hora',po:'PO o número de orden',optional:'Opcional',poExample:'Ejemplo: PO-45872',notes:'Notas',notesPlaceholder:'Instrucciones de entrega para el conductor',publish:'Publicar ruta',publishing:'Publicando...',published:'Ruta publicada correctamente.',chooseRequired:'Elige un conductor e introduce un destino.',workspacePending:'La empresa aún no está lista. Actualiza e inténtalo nuevamente.',invalidDate:'Elige una fecha y hora válidas.',loadError:'No se pudo cargar la información de las rutas.',saveError:'No se pudo guardar la ruta.',preview:'Vista previa de la ruta',previewHelp:'Elige un contacto o escribe una dirección.',openMaps:'Abrir en Google Maps',teamDriver:'Conductor del equipo',route:'Ruta',inProgress:'En progreso',statusPublished:'Publicada',paused:'Pausada',issue:'Incidencia',draft:'Borrador',pending:'Pendiente',noTime:'Sin hora',today:'Hoy',normal:'Normal',priorityName:'Prioridad',urgent:'Urgente',pickup:'Recogida',delivery:'Entrega',transfer:'Ruta personalizada',return:'Regresar a sucursal'},
  fr:{operations:'Opérations des itinéraires',title:'Itinéraires',subtitle:'Consultez les affectations actives et publiez le prochain itinéraire.',manage:'Gérer les itinéraires',add:'Ajouter un itinéraire',assigned:'Itinéraires attribués',assignedHelp:'Les itinéraires publiés, actifs et en pause apparaissent ici.',active:'actifs',branch:'Succursale',destinationPending:'Destination en attente',noPo:'Sans PO',orderReference:'Référence de commande',viewManage:'Voir et gérer',empty:'Aucun itinéraire actif',emptyHelp:'Publiez le premier itinéraire de l’équipe pour aujourd’hui.',newAssignment:'Nouvelle affectation',create:'Créer un itinéraire',close:'Fermer le formulaire',chooseDestination:'Choisir une destination',routeType:'Type d’itinéraire',returnToBranch:'Retour à la succursale',returnHelp:'Utilise la succursale comme destination. Vous pouvez toujours choisir le point de départ.',driver:'Conducteur',chooseDriver:'Choisir un conducteur',startingPoint:'Point de départ',originPlaceholder:'Succursale ou adresse de départ',contactDestination:'Contact ou destination',searchPlaceholder:'Rechercher un contact ou saisir une adresse',searchHelp:'Saisissez une adresse pour afficher des suggestions ou choisissez un contact enregistré.',priority:'Priorité',date:'Date',time:'Heure',po:'PO ou numéro de commande',optional:'Facultatif',poExample:'Exemple : PO-45872',notes:'Notes',notesPlaceholder:'Instructions de livraison pour le conducteur',publish:'Publier l’itinéraire',publishing:'Publication...',published:'Itinéraire publié.',chooseRequired:'Choisissez un conducteur et saisissez une destination.',workspacePending:'L’espace entreprise n’est pas prêt. Actualisez et réessayez.',invalidDate:'Choisissez une date et une heure valides.',loadError:'Impossible de charger les itinéraires.',saveError:'Impossible d’enregistrer l’itinéraire.',preview:'Aperçu de l’itinéraire',previewHelp:'Choisissez un contact ou saisissez une adresse.',openMaps:'Ouvrir dans Google Maps',teamDriver:'Conducteur de l’équipe',route:'Itinéraire',inProgress:'En cours',statusPublished:'Publié',paused:'En pause',issue:'Incident',draft:'Brouillon',pending:'En attente',noTime:'Aucune heure',today:'Aujourd’hui',normal:'Normal',priorityName:'Priorité',urgent:'Urgent',pickup:'Collecte',delivery:'Livraison',transfer:'Itinéraire personnalisé',return:'Retour à la succursale'},
}
type RouteCopy = typeof routeCopy.en

function localSchedule() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString()
  return {date: local.slice(0, 10), time: local.slice(11, 16)}
}

function initialForm(priority: FormState['priority'] = 'normal'): FormState {
  return {
    type: 'delivery',
    origin: '',
    destination: '',
    destination_label: '',
    destination_phone: '',
    contact_id: '',
    priority,
    order_number: '',
    notes: '',
    ...localSchedule(),
    driver_id: '',
  }
}

function profileFor(driver: Driver) {
  return Array.isArray(driver.users) ? driver.users[0] : driver.users
}

function friendlyName(email?: string | null) {
  if (!email) return 'Team driver'
  const local = email.split('@')[0] || ''
  const words = local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  return words.join(' ') || 'Team driver'
}

function driverDetails(driver?: Driver, fallback='Team driver') {
  const profile = profileFor(driver || {user_id: ''})
  const email = profile?.email || ''
  return {name: profile?.name || (email ? friendlyName(email) : fallback), email}
}

function typeLabel(type: string | null | undefined, c: RouteCopy) {
  return type === 'pickup' ? c.pickup : type === 'delivery' ? c.delivery : type === 'return' ? c.return : type === 'transfer' ? c.transfer : c.route
}

function statusLabel(status: string | null | undefined, c: RouteCopy) {
  if (status === 'active') return c.inProgress
  if (status === 'published') return c.statusPublished
  if (status === 'paused') return c.paused
  if (status === 'issue') return c.issue
  if (status === 'draft') return c.draft
  return c.pending
}

function routeTime(route: RouteRecord, locale:string, c:RouteCopy) {
  if (!route.scheduled_at) return c.noTime
  const date = new Date(route.scheduled_at)
  if (Number.isNaN(date.getTime())) return c.noTime
  return new Intl.DateTimeFormat(locale, {hour: 'numeric', minute: '2-digit'}).format(date)
}

function routeDate(route: RouteRecord, locale:string, c:RouteCopy) {
  const value = route.scheduled_at || route.route_date
  if (!value) return c.today
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return c.today
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return c.today
  return new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric'}).format(date)
}

function MapPreview({address,c}: {address?: string;c:RouteCopy}) {
  const query = address?.trim() ? encodeURIComponent(address.trim()) : ''
  return <div className={styles.mapShell}>
    {query ? <iframe title="Destination map preview" src={`https://www.google.com/maps?q=${query}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className={styles.mapPlaceholder}>
      <div className={styles.mapGrid}/>
      <div className={styles.routeLine}><span/><i/><b/></div>
      <div className={styles.mapCopy}><MapPin size={20}/><div><strong>{c.preview}</strong><span>{c.previewHelp}</span></div></div>
    </div>}
    {query && <a className={styles.mapLink} href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noreferrer"><MapPin size={15}/>{c.openMaps}</a>}
  </div>
}

export default function Routes() {
  const {locale,t}=useLocale()
  const c=routeCopy[locale]
  const searchParams = useSearchParams()
  const requestedPriority = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
  const [form, setForm] = useState<FormState>(() => initialForm(requestedPriority))
  const [contacts, setContacts] = useState<Contact[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driverLocations, setDriverLocations] = useState<Record<string,string>>({})
  const [routes, setRoutes] = useState<RouteRecord[]>([])
  const [companyId, setCompanyId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const [originMode, setOriginMode] = useState<OriginMode>('branch')
  const [previewOpen, setPreviewOpen] = useState(false)

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    try {
      const client = getSupabase()
      const {data: userData, error: userError} = await client.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw Error('Sign in to view routes.')
      setCurrentUserId(userData.user.id)

      const {data: membership, error: membershipError} = await client
        .from('company_users')
        .select('company_id,branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!membership) throw Error('No company membership was found.')

      setCompanyId(membership.company_id)
      setBranchId(membership.branch_id || null)

      let assigneeQuery = client.from('company_users').select('user_id,role,branch_id,users(email,name)').eq('company_id', membership.company_id).in('role', ['driver', 'branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'])
      if (membership.branch_id) assigneeQuery = assigneeQuery.or(`branch_id.is.null,branch_id.eq.${membership.branch_id}`)
      const [contactResult, driverResult, routeResult, branchResult, locationResult] = await Promise.all([
        client.from('contacts').select('id,company_name,contact_name,address,phone').eq('company_id', membership.company_id).order('company_name'),
        assigneeQuery,
        client.from('routes').select('id,driver_id,mission_type,priority,status,origin_name,origin_address,destination_name,destination_address,destination_phone,scheduled_at,route_date,position,notes,order_number').eq('company_id', membership.company_id).in('status', routeStatuses).order('scheduled_at', {ascending:true, nullsFirst:false}).order('position', {ascending:true}),
        client.from('branches').select('id,name,address,primary_driver_id').eq('company_id', membership.company_id).order('name'),
        client.from('driving_sessions').select('driver_id,last_lat,last_lng,last_updated_at,status').eq('company_id', membership.company_id).in('status',['active','paused']).order('last_updated_at',{ascending:false}),
      ])
      if (contactResult.error) throw contactResult.error
      if (driverResult.error) throw driverResult.error
      if (routeResult.error) throw routeResult.error
      if (branchResult.error) throw branchResult.error
      if (locationResult.error) throw locationResult.error
      const driverIds = ((driverResult.data || []) as Driver[]).map(driver => driver.user_id).filter(Boolean)
      const profileResult = driverIds.length ? await client.from('users').select('id,name,email').in('id', driverIds) : {data: [], error: null}
      if (profileResult.error) throw profileResult.error

      const availableBranches = (branchResult.data || []) as Branch[]
      const defaultBranch = availableBranches.find(branch => branch.id === membership.branch_id) || availableBranches[0]
      const profileById = new Map((profileResult.data || []).map(profile => [profile.id, profile]))
      const availableDrivers = ((driverResult.data || []) as Driver[]).map(driver => ({...driver, users: profileById.get(driver.user_id) || driver.users})).sort((a,b) => Number(b.user_id === defaultBranch?.primary_driver_id) - Number(a.user_id === defaultBranch?.primary_driver_id) || Number(b.role === 'driver') - Number(a.role === 'driver'))
      const preferredDriver = chooseDefaultAssignee(availableDrivers, defaultBranch?.primary_driver_id)
      setContacts((contactResult.data || []) as Contact[])
      setDrivers(availableDrivers)
      setRoutes((routeResult.data || []) as RouteRecord[])
      setBranches(availableBranches)
      const latestLocations: Record<string,string> = {}
      for (const row of (locationResult.data || []) as Array<{driver_id:string;last_lat:number|null;last_lng:number|null}>) if (latestLocations[row.driver_id]===undefined && row.last_lat!=null && row.last_lng!=null) latestLocations[row.driver_id] = `${row.last_lat}, ${row.last_lng}`
      setDriverLocations(latestLocations)
      setForm(current => ({
        ...current,
        driver_id: availableDrivers.some(driver => driver.user_id === current.driver_id) ? current.driver_id : preferredDriver?.user_id || '',
        origin: current.origin || defaultBranch?.address || defaultBranch?.name || '',
      }))
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError)
    } finally {
      setLoading(false)
    }
  }, [c.loadError])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  useEffect(() => {
    const requestedContact = searchParams.get('contact')
    const requestedDestination = searchParams.get('destination')
    const requestedType = searchParams.get('type')
    const requestedPriority = searchParams.get('priority')
    if (searchParams.get('new') === '1' || requestedContact || requestedDestination || requestedPriority === 'urgent') {
      const contact = contacts.find(item => item.id === requestedContact)
      setForm(current => ({
        ...current,
        type: ['pickup','delivery','transfer','return'].includes(requestedType || '') ? requestedType as FormState['type'] : current.type,
        priority: requestedPriority === 'urgent' || requestedPriority === 'priority' ? requestedPriority : current.priority,
        contact_id: contact?.id || '',
        destination: contact ? `${contact.company_name} - ${contact.address}` : requestedDestination || current.destination,
      }))
      setOpen(true)
    }
  }, [contacts, searchParams])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, saving])

  const driverIndex = useMemo(() => new Map(drivers.map(driver => [driver.user_id, driver])), [drivers])
  const selectedContact = contacts.find(contact => contact.id === form.contact_id)
  const destinationSuggestions = useMemo<LocalAddressSuggestion[]>(() => contacts.map(contact => ({
    id: contact.id,
    primary: contact.company_name,
    secondary: [contact.contact_name, contact.address].filter(Boolean).join(' · '),
    value: `${contact.company_name} - ${contact.address}`,
  })), [contacts])
  const previewAddress = selectedContact?.address || form.destination
  const oc = originCopy[locale]
  const defaultBranch = branches.find(branch => branch.id === branchId) || branches[0]
  const previousRoute = useMemo(() => routes
    .filter(route => route.driver_id === form.driver_id && route.route_date === form.date)
    .sort((a,b) => Number(b.position || 0) - Number(a.position || 0))[0], [routes, form.driver_id, form.date])

  useEffect(() => {
    if (originMode !== 'previous') return
    setForm(current => ({...current, origin: previousRoute?.destination_address || previousRoute?.destination_name || driverLocations[current.driver_id] || ''}))
  }, [originMode, previousRoute, driverLocations])

  const setOriginSource = (mode: OriginMode) => {
    setOriginMode(mode)
    if (mode === 'branch') setForm(current => ({...current, origin: defaultBranch?.address || defaultBranch?.name || ''}))
    if (mode === 'previous') setForm(current => ({...current, origin: previousRoute?.destination_address || previousRoute?.destination_name || driverLocations[current.driver_id] || ''}))
    if (mode === 'contact') setForm(current => ({...current, origin: contacts[0]?.address || ''}))
    if (mode === 'custom') setForm(current => ({...current, origin: ''}))
  }

  const updateDestination = (value: string) => {
    const normalized = value.trim().toLowerCase()
    const contact = contacts.find(item => {
      const option = `${item.company_name} - ${item.address}`.toLowerCase()
      return option === normalized || item.company_name.toLowerCase() === normalized || item.address.toLowerCase() === normalized
    })
    setForm(current => {
      // A saved contact supplies the complete destination snapshot. If the
      // dispatcher replaces it with a new address, do not accidentally carry
      // the previous customer's name or phone into that custom stop.
      const replacingSavedContact = Boolean(current.contact_id)
      return {
        ...current,
        destination: value,
        contact_id: contact?.id || '',
        destination_label: contact ? '' : replacingSavedContact ? '' : current.destination_label,
        destination_phone: contact?.phone || (replacingSavedContact ? '' : current.destination_phone),
      }
    })
  }

  const selectDestinationContact = (suggestion: LocalAddressSuggestion) => {
    setForm(current => ({...current, destination: suggestion.value, contact_id: suggestion.id, destination_label: '', destination_phone:contacts.find(contact=>contact.id===suggestion.id)?.phone||''}))
  }

  const openBuilder = () => {
    const nextPriority: FormState['priority'] = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
    const next = initialForm(nextPriority)
    const driverId = chooseDefaultAssignee(drivers, defaultBranch?.primary_driver_id)?.user_id || form.driver_id || ''
    const lastForDriver = routes.filter(route => route.driver_id === driverId && route.route_date === next.date).sort((a,b) => Number(b.position || 0) - Number(a.position || 0))[0]
    setOriginMode(lastForDriver ? 'previous' : 'branch')
    setForm({...next, driver_id: driverId, origin: lastForDriver?.destination_address || lastForDriver?.destination_name || defaultBranch?.address || defaultBranch?.name || ''})
    setMessage('')
    setDetailsOpen(false)
    setJustCreated(false)
    setOpen(true)
  }

  const save = async () => {
    if (saving) return
    if (!form.destination.trim() || !form.driver_id) {
      setMessage(c.chooseRequired)
      return
    }
    if (!companyId) {
      setMessage(c.workspacePending)
      return
    }

    setSaving(true)
    setMessage(c.publishing)
    try {
      const client = getSupabase()
      const scheduledLocal = new Date(`${form.date}T${form.time || '00:00'}`)
      if (Number.isNaN(scheduledLocal.getTime())) throw Error(c.invalidDate)
      const scheduledAt = scheduledLocal.toISOString()
      const selected = contacts.find(contact => contact.id === form.contact_id)
      const destinationAddress = selected?.address || form.destination.trim()
      const destinationName = selected?.company_name || form.destination_label.trim() || form.destination.trim()
      const destinationPhone = selected?.phone || form.destination_phone.trim() || null

      let positionQuery = client
        .from('routes')
        .select('position')
        .eq('company_id', companyId)
        .eq('driver_id', form.driver_id)
        .eq('route_date', form.date)
        .in('status', routeStatuses)
        .order('position', {ascending:false})
        .limit(1)
      positionQuery = branchId
        ? positionQuery.eq('branch_id', branchId)
        : positionQuery.is('branch_id', null)
      const {data: lastRoute, error: positionError} = await positionQuery.maybeSingle()
      if (positionError) throw positionError

      const {data: createdRoute,error} = await client.from('routes').insert({
        company_id: companyId,
        branch_id: branchId,
        driver_id: form.driver_id,
        route_date: form.date,
        mode: 'flexible',
        status: 'published',
        mission_type: form.type,
        origin_name: originMode === 'branch' ? defaultBranch?.name || c.branch : originMode === 'previous' ? previousRoute?.destination_name || form.origin.trim() : contacts.find(contact => contact.address === form.origin)?.company_name || form.origin.trim(),
        origin_address: form.origin.trim() || defaultBranch?.address || defaultBranch?.name || c.branch,
        destination_name: destinationName,
        destination_address: destinationAddress,
        destination_phone: destinationPhone,
        priority: form.priority,
        order_number: form.order_number.trim() || null,
        notes: form.notes.trim() || null,
        scheduled_at: scheduledAt,
        position: Number(lastRoute?.position || 0) + 1,
      }).select('id').single()
      if (error) throw error

      if (createdRoute?.id && currentUserId) await recordActivity({companyId,userId:currentUserId,action:'route_created',recordId:createdRoute.id,after:{driver_id:form.driver_id,priority:form.priority,destination:destinationAddress}}).catch(()=>undefined)
      window.dispatchEvent(new Event('routehub:notifications-refresh'))

      const requestId = searchParams.get('request')
      if (requestId) {
        const {error: requestError} = await client.from('requests').update({status:'assigned'}).eq('id', requestId).eq('company_id', companyId)
        if (requestError) throw requestError
      }

      setForm(current => ({...initialForm(), driver_id: current.driver_id}))
      await loadWorkspace()
      setMessage(c.published)
      setJustCreated(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      setSaving(false)
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{c.operations.toUpperCase()}</p>
        <h1>{c.title}</h1>
        <p>{c.subtitle}</p>
      </div>
      <div className={styles.headerActions}>
        <Link className={styles.secondaryButton} href="/contacts"><Users size={18}/>{t.contacts}</Link>
        <Link className={styles.secondaryButton} href="/routes/manage"><RouteIcon size={18}/>{c.manage}</Link>
        <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
      </div>
    </header>

    {message && <div className={message.includes('successfully') ? styles.successMessage : styles.message} role="status">{message}</div>}

    <LiveRoute companyId={companyId} branchId={branchId}/>

    <section className={styles.listHeading}>
      <div><h2>{routes.length ? c.assigned : c.today}</h2><p>{routes.length ? c.assignedHelp : (locale==='es' ? 'Crea una ruta cuando estés listo.' : locale==='fr' ? 'Créez un itinéraire lorsque vous êtes prêt.' : 'Create a route when you are ready.')}</p></div>
      {!loading && <span>{routes.length} {c.active}</span>}
    </section>

    {loading ? <section className={styles.routeGrid} aria-label={c.loadError}>
      {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
    </section> : routes.length ? <section className={styles.routeGrid}>
      {routes.map((route, index) => {
        const details = driverDetails(route.driver_id ? driverIndex.get(route.driver_id) : undefined,c.teamDriver)
        const origin = route.origin_name || route.origin_address || c.branch
        const destination = route.destination_name || route.destination_address || c.destinationPending
        const priority = route.priority || 'normal'
        const status = route.status || 'pending'
        return <article className={`${styles.routeCard} ${priority === 'urgent' ? styles.urgentCard : ''}`} key={route.id}>
          <div className={styles.cardTop}>
            <div className={styles.routeIdentity}><span className={styles.routeNumber}>{String(route.position || index + 1).padStart(2, '0')}</span><div><small>{typeLabel(route.mission_type,c)}</small><strong>{destination}</strong></div></div>
            <div className={`${styles.statusBadge} ${styles[`status_${status}`] || ''}`}><CircleDot size={12}/>{statusLabel(status,c)}</div>
          </div>
          <div className={styles.routePath}><MapPin size={17}/><span>{origin}</span><ArrowRight size={16}/><strong>{destination}</strong></div>
          <div className={styles.routeDetails}>
            <div><UserRound size={16}/><span><strong>{details.name}</strong>{details.email && <small>{details.email}</small>}</span></div>
            <div><CalendarDays size={16}/><span><strong>{routeDate(route,locale,c)}</strong><small>{routeTime(route,locale,c)}</small></span></div>
            {route.mission_type==='pickup'&&<div><PackageCheck size={16}/><span><strong>{route.order_number || c.noPo}</strong><small>{c.orderReference}</small></span></div>}
            {route.mission_type==='delivery'&&route.order_number&&<div><PackageCheck size={16}/><span><strong>{route.order_number}</strong><small>{locale==='es'?'Trabajo / orden':locale==='fr'?'Chantier / commande':'Job / order'}</small></span></div>}
          </div>
          <div className={styles.cardFooter}>
            <span className={`${styles.priorityBadge} ${styles[`priority_${priority}`] || ''}`}>{priority==='urgent'?c.urgent:priority==='priority'?c.priorityName:c.normal}</span>
            <Link href="/routes/manage">{c.viewManage}<ChevronRight size={16}/></Link>
          </div>
        </article>
      })}
    </section> : <section className={styles.emptyState}>
      <div><RouteIcon size={28}/></div><h2>{c.empty}</h2><p>{c.emptyHelp}</p><button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
    </section>}

    {open && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false) }}>
      <section className={styles.builder} role="dialog" aria-modal="true" aria-labelledby="new-route-title">
        <div className={`${styles.builderHeader} ${contrast.header}`}>
          <div><p className={styles.eyebrow}>{c.newAssignment.toUpperCase()}</p><h2 id="new-route-title">{c.create}</h2></div>
          <button className={styles.closeButton} type="button" aria-label={c.close} disabled={saving} onClick={() => setOpen(false)}><X size={22}/></button>
        </div>

        {justCreated ? <div className={styles.successPanel}>
          <div className={styles.successIcon}><CheckCircle2 size={34}/></div>
          <h3>{c.published}</h3>
          <p>{locale==='es' ? 'La ruta ya aparece para el conductor asignado.' : locale==='fr' ? 'L’itinéraire est maintenant disponible pour le conducteur assigné.' : 'The route is now available to the assigned driver.'}</p>
          <div className={styles.successActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setOpen(false)}>{locale==='es' ? 'Listo' : locale==='fr' ? 'Terminé' : 'Done'}</button>
            <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{locale==='es' ? 'Añadir otra' : locale==='fr' ? 'Ajouter une autre' : 'Add another'}</button>
          </div>
        </div> : <div className={styles.builderBody}>
          <button type="button" className={styles.mobileMapButton} onClick={() => setPreviewOpen(value => !value)}><MapPin size={16}/>{previewOpen ? 'Hide map' : 'View map'}</button>
          <div className={`${styles.mapColumn} ${previewOpen ? styles.mapColumnOpen : ''}`}>
            <MapPreview address={previewAddress} c={c}/>
            <div className={styles.previewSummary}><span><i>1</i>{form.origin.trim() || c.branch}</span><span><i>2</i>{selectedContact?.company_name || form.destination.trim() || c.chooseDestination}</span></div>
          </div>

          <div className={`${styles.formColumn} ${contrast.form}`}>
            <fieldset className={`${styles.fieldset} ${styles.primaryRouteTypes}`}>
              <legend>{c.routeType}</legend>
              <div className={styles.segmented}>{routeTypes.map(type => <button className={form.type === type.value ? styles.segmentActive : ''} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => setForm(current => type.value === 'return' ? {...current, type:'return', destination:defaultBranch?.address || defaultBranch?.name || '', destination_label:defaultBranch?.name||'', destination_phone:'', contact_id:''} : {...current, type:type.value})}>{typeLabel(type.value,c)}</button>)}</div>
            </fieldset>

              <label className={`${styles.field} ${styles.driverField}`}><span>{c.driver}</span><div className={styles.inputWrap}><UserRound size={18}/><select value={form.driver_id} onChange={event => setForm(current => ({...current, driver_id: event.target.value}))}><option value="">{c.chooseDriver}</option>{drivers.map((driver,index) => { const fallback=`${c.driver} ${index+1}`; const details = driverDetails(driver,driver.role==='driver'?c.teamDriver:fallback); const isPrimary=driver.user_id===defaultBranch?.primary_driver_id; const roleName=isPrimary?(locale==='es'?'Conductor principal':locale==='fr'?'Conducteur principal':'Primary Driver'):(driver.role||c.teamDriver).replaceAll('_',' '); return <option key={driver.user_id} value={driver.user_id}>{`${isPrimary?'★ ':''}${details.name||fallback} — ${roleName}`}</option> })}</select></div></label>

            <fieldset className={styles.fieldset}>
              <legend>{c.startingPoint}</legend>
              <div className={styles.segmented}>{(['branch','previous'] as OriginMode[]).map(mode => <button className={originMode === mode ? styles.segmentActive : ''} type="button" key={mode} aria-pressed={originMode === mode} onClick={() => setOriginSource(mode)}>{oc[mode]}</button>)}</div>
              {originMode === 'branch' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm(current => ({...current, origin:event.target.value}))}><option value="">{oc.chooseBranch}</option>{branches.map(branch => <option key={branch.id} value={branch.address || branch.name}>{branch.name}{branch.address ? ` - ${branch.address}` : ''}</option>)}</select></div>}
              {originMode === 'previous' && <div className={styles.inputWrap}><MapPin size={18}/><input value={form.origin} onChange={event => setForm(current => ({...current, origin:event.target.value}))} placeholder={oc.noPrevious}/></div>}
              {originMode === 'contact' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm(current => ({...current, origin:event.target.value}))}><option value="">{oc.chooseContact}</option>{contacts.map(contact => <option key={contact.id} value={contact.address}>{contact.company_name} - {contact.address}</option>)}</select></div>}
              {originMode === 'custom' && <div className={styles.inputWrap}><MapPin size={18}/><GoogleAddressInput value={form.origin} placeholder={c.originPlaceholder} onValueChange={value => setForm(current => ({...current, origin:value}))}/></div>}
            </fieldset>

            {form.type==='return'?<label className={styles.field}><span>{locale==='es'?'Sucursal de regreso':locale==='fr'?'Succursale de retour':'Return branch'}</span><div className={styles.inputWrap}><MapPin size={18}/><select value={form.destination} onChange={event=>{const branch=branches.find(item=>(item.address||item.name)===event.target.value);setForm(current=>({...current,destination:event.target.value,destination_label:branch?.name||'',destination_phone:'',contact_id:''}))}}>{branches.map(branch=><option key={branch.id} value={branch.address||branch.name}>{branch.name}{branch.address?` — ${branch.address}`:''}</option>)}</select></div></label>:<><label className={styles.field}><span>{form.type==='pickup'?'Pickup From / Location':'Deliver To / Delivery Address'}</span><div className={styles.inputWrap}><Search size={18}/><GoogleAddressInput value={form.destination} placeholder={c.searchPlaceholder} onValueChange={updateDestination} localSuggestions={destinationSuggestions} onSelectLocalSuggestion={selectDestinationContact}/></div><small>{c.searchHelp}</small></label>{form.type==='pickup'&&<label className={styles.field}><span>{c.po}</span><input value={form.order_number} placeholder={c.poExample} onChange={event => setForm(current => ({...current, order_number:event.target.value}))}/></label>}{selectedContact?<div className={styles.savedContact} aria-live="polite"><UserRound size={19}/><div><small>{locale==='es'?'Contacto guardado — se enviará al conductor':locale==='fr'?'Contact enregistré — envoyé au conducteur':'Saved contact — sent to driver'}</small><strong>{selectedContact.company_name}</strong><span>{[selectedContact.contact_name,selectedContact.phone].filter(Boolean).join(' · ') || selectedContact.address}</span></div></div>:form.type==='delivery'?<label className={styles.field}><span>{locale==='es'?'Teléfono del contacto':locale==='fr'?'Téléphone du contact':'Contact phone'} <em>{c.optional}</em></span><input type="tel" value={form.destination_phone} onChange={event=>setForm(current=>({...current,destination_phone:event.target.value}))}/></label>:null}</>}
            {form.type==='return'&&<label className={styles.field}><span>{c.notes} <em>{c.optional}</em></span><textarea rows={2} value={form.notes} placeholder={locale==='es'?'Ejemplo: Recoger material para la próxima entrega':locale==='fr'?'Exemple : récupérer le matériel pour la prochaine livraison':'Example: Pick up material for next delivery'} onChange={event => setForm(current => ({...current, notes:event.target.value}))}/></label>}

            {form.type!=='return'&&<button className={styles.detailsToggle} type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}><SlidersHorizontal size={17}/>{locale==='es' ? 'Más detalles' : locale==='fr' ? 'Plus de détails' : 'More details'}<ChevronRight size={16} className={detailsOpen ? styles.detailsChevronOpen : ''}/></button>}

            {detailsOpen && form.type!=='return' && <div className={styles.optionalDetails}>
              <fieldset className={styles.fieldset}>
                <legend>{c.priority}</legend>
                <div className={`${styles.segmented} ${styles.prioritySegments}`}>{priorities.map(priority => <button className={form.priority === priority.value ? styles.segmentActive : ''} data-priority={priority.value} type="button" key={priority.value} aria-pressed={form.priority === priority.value} onClick={() => setForm(current => ({...current, priority: priority.value}))}>{priority.value==='urgent'?c.urgent:priority.value==='priority'?c.priorityName:c.normal}</button>)}</div>
              </fieldset>
              <div className={styles.splitFields}>
                <label className={styles.field}><span>{c.date}</span><div className={styles.inputWrap}><CalendarDays size={18}/><input type="date" value={form.date} onChange={event => setForm(current => ({...current, date: event.target.value}))}/></div></label>
                <label className={styles.field}><span>{c.time}</span><div className={styles.inputWrap}><Clock3 size={18}/><input type="time" value={form.time} onChange={event => setForm(current => ({...current, time: event.target.value}))}/></div></label>
              </div>
              {form.type!=='pickup'&&<label className={styles.field}><span>{locale==='es'?'Job / número de orden':locale==='fr'?'Chantier / numéro de commande':'Job / order number'} <em>{c.optional}</em></span><input value={form.order_number} placeholder={c.poExample} onChange={event => setForm(current => ({...current, order_number: event.target.value}))}/></label>}
              <label className={styles.field}><span>{form.type==='delivery'?(locale==='es'?'Instrucciones de entrega':locale==='fr'?'Instructions de livraison':'Delivery instructions'):c.notes} <em>{c.optional}</em></span><textarea rows={3} value={form.notes} placeholder={form.type==='delivery'?c.notesPlaceholder:c.notes} onChange={event => setForm(current => ({...current, notes: event.target.value}))}/></label>
              {form.type==='pickup'&&!selectedContact&&<label className={styles.field}><span>{locale==='es'?'Teléfono del contacto':locale==='fr'?'Téléphone du contact':'Contact phone'} <em>{c.optional}</em></span><input type="tel" value={form.destination_phone} onChange={event=>setForm(current=>({...current,destination_phone:event.target.value}))}/></label>}
            </div>}

            <button className={styles.publishButton} type="button" disabled={saving || !form.driver_id || !form.destination.trim()} onClick={save}>{saving ? <><span className={styles.spinner}/>{c.publishing}</> : <><Truck size={19}/>{c.publish}</>}</button>
          </div>
        </div>}
      </section>
    </div>}
  </main>
}
