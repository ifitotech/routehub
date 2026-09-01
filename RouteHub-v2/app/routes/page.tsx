'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import nextDynamic from 'next/dynamic'
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
  UserPlus,
  X,
} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import {useLocale} from '../../lib/use-preferences'
import {recordActivity} from '../../lib/activity'
import {sendRoutePush} from '../../lib/route-push'
import {chooseDefaultAssignee} from '../../lib/route-assignment'
import ManagerShell from '../manager/manager-shell'
import type {GeocodedLocation} from '../../lib/maps/types'
import GoogleAddressInput, {type AddressSearchSuggestion, type LocalAddressSuggestion} from '../google-address-input'
import styles from './routes.module.css'
import contrast from './route-contrast.module.css'

const OperationsMap = nextDynamic(() => import('../operations-map'), {ssr: false})
const LocationConfirmMap = nextDynamic(() => import('../location-confirm-map'), {ssr: false})

type Contact = {
  id: string
  company_name: string
  contact_name?: string | null
  location_code?: string | null
  address: string
  phone?: string | null
  latitude?: number | null
  longitude?: number | null
  location_source?: GeocodedLocation['source'] | null
  location_external_id?: string | null
}

type DriverProfile = {email?: string | null; name?: string | null}
type Branch = {
  id: string
  name: string
  address?: string | null
  primary_driver_id?: string | null
  latitude?: number | null
  longitude?: number | null
  location_source?: GeocodedLocation['source'] | null
  location_external_id?: string | null
}

function storedCoordinate(value:string|undefined){
  if(!value)return null
  const [lat,lng]=value.split(',').map(Number)
  return sanitizeCoordinate({lat,lng})
}

function savedCoordinate(location:{latitude?:number|null;longitude?:number|null}|null|undefined){
  return sanitizeCoordinate({lat:location?.latitude,lng:location?.longitude})
}

function branchLocation(branch:Branch|null|undefined):GeocodedLocation|null{
  const coordinate=savedCoordinate(branch)
  if(!branch||!coordinate)return null
  return {
    name:branch.name,
    formattedAddress:branch.address||branch.name,
    coordinate,
    source:branch.location_source||'routehub',
    externalId:branch.location_external_id||undefined,
  }
}

type OriginMode = 'branch' | 'previous' | 'contact' | 'custom'
type Driver = {
  user_id: string
  role?: string
  users?: DriverProfile | DriverProfile[] | null
}

type RouteRecord = {
  id: string
  company_id?: string | null
  branch_id?: string | null
  driver_id: string | null
  mission_type: string | null
  priority: string | null
  status: string | null
  origin_name: string | null
  origin_address: string | null
  destination_name: string | null
  destination_address: string | null
  destination_lat: number | null
  destination_lng: number | null
  destination_location_source: GeocodedLocation['source'] | null
  destination_location_external_id: string | null
  origin_lat: number | null
  origin_lng: number | null
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
  stop_contact_name: string
  contact_id: string
  priority: 'normal' | 'priority' | 'urgent'
  order_number: string
  notes: string
  date: string
  time: string
  driver_id: string
  insert_before_id: string
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
// Completed routes stay available in the planning view so dispatchers can
// distinguish today's work from future work without losing the audit trail.
const routeListStatuses = [...routeStatuses, 'completed', 'issue']
const routeTypes: Array<{value: FormState['type']; label: string}> = [
  {value: 'pickup', label: 'Pickup'},
  {value: 'delivery', label: 'Delivery'},
  {value: 'return', label: 'Return to branch'},
]

const routeCopy = {
  en:{operations:'Route operations',title:'Routes',subtitle:'Plan, organize and publish your team routes.',manage:'Manage routes',add:'Add route',assigned:'Route plan',assignedHelp:'Today’s work, scheduled routes and completed stops stay organized here.',active:'routes',todaySection:'Today',upcomingSection:'Upcoming / Scheduled',inProgressSection:'In progress',completedSection:'Completed today',completedStatus:'Completed',tomorrow:'Tomorrow',branch:'Branch',destinationPending:'Destination pending',noPo:'No PO',orderReference:'Order reference',viewManage:'View and manage',empty:'No routes scheduled today',emptyHelp:'Publish the first route for your team today.',newAssignment:'New assignment',create:'Create route',close:'Close route form',chooseDestination:'Choose destination',routeType:'Route type',returnToBranch:'Return to branch',returnHelp:'Sets your branch as the destination. You can still choose the starting point.',driver:'Driver',chooseDriver:'Choose driver',startingPoint:'Starting point',originPlaceholder:'Branch or starting address',contactDestination:'Contact or destination',searchPlaceholder:'Search a contact or type an address',searchHelp:'Start typing to see address suggestions, or select a saved contact.',priority:'Priority',date:'Date',time:'Time',po:'PO or order number',optional:'Optional',poExample:'Example: PO-45872',notes:'Notes',notesPlaceholder:'Delivery instructions for the driver',publish:'Publish route',publishing:'Publishing...',published:'Route published successfully.',chooseRequired:'Choose a driver and enter a destination.',workspacePending:'The company workspace is not ready. Refresh and try again.',invalidDate:'Choose a valid date and time.',loadError:'Unable to load route information.',saveError:'Unable to save route.',preview:'Route preview',previewHelp:'Choose a contact or enter an address.',openMaps:'Open in Google Maps',teamDriver:'Team driver',route:'Route',inProgress:'In progress',statusPublished:'Published',paused:'Paused',issue:'Issue',draft:'Draft',pending:'Pending',noTime:'No time set',today:'Today',normal:'Normal',priorityName:'Priority',urgent:'Urgent',pickup:'Pickup',delivery:'Delivery',transfer:'Custom route',return:'Return to branch',pickupFrom:'Pickup from / location',deliveryTo:'Deliver to / delivery address',contactPhone:'Contact phone',addToContacts:'Add to contacts',contactName:'Contact name',contactNamePlaceholder:'Example: Fox Electric',saveContact:'Save contact',savingContact:'Saving…',contactSaved:'Contact saved. It will be available next time.',contactAlreadyExists:'This contact already exists.',contactSaveError:'Could not save contact.'},
  es:{operations:'Operaciones de rutas',title:'Rutas',subtitle:'Planifica, organiza y publica las rutas del equipo.',manage:'Gestionar rutas',add:'Añadir ruta',assigned:'Plan de rutas',assignedHelp:'El trabajo de hoy, las rutas programadas y las completadas quedan organizadas aquí.',active:'rutas',todaySection:'Hoy',upcomingSection:'Próximas / programadas',inProgressSection:'En progreso',completedSection:'Completadas hoy',completedStatus:'Completada',tomorrow:'Mañana',branch:'Sucursal',destinationPending:'Destino pendiente',noPo:'Sin PO',orderReference:'Referencia de orden',viewManage:'Ver y gestionar',empty:'No hay rutas programadas hoy',emptyHelp:'Publica la primera ruta del equipo para hoy.',newAssignment:'Nueva asignación',create:'Crear ruta',close:'Cerrar formulario',chooseDestination:'Elige un destino',routeType:'Tipo de ruta',returnToBranch:'Regresar a sucursal',returnHelp:'Usa la sucursal como destino. Aún puedes elegir el punto de salida.',driver:'Conductor',chooseDriver:'Elige un conductor',startingPoint:'Punto de salida',originPlaceholder:'Sucursal o dirección de salida',contactDestination:'Contacto o destino',searchPlaceholder:'Busca un contacto o escribe una dirección',searchHelp:'Escribe para ver sugerencias de direcciones o selecciona un contacto guardado.',priority:'Prioridad',date:'Fecha',time:'Hora',po:'PO o número de orden',optional:'Opcional',poExample:'Ejemplo: PO-45872',notes:'Notas',notesPlaceholder:'Instrucciones de entrega para el conductor',publish:'Publicar ruta',publishing:'Publicando...',published:'Ruta publicada correctamente.',chooseRequired:'Elige un conductor e introduce un destino.',workspacePending:'La empresa aún no está lista. Actualiza e inténtalo nuevamente.',invalidDate:'Elige una fecha y hora válidas.',loadError:'No se pudo cargar la información de las rutas.',saveError:'No se pudo guardar la ruta.',preview:'Vista previa de la ruta',previewHelp:'Elige un contacto o escribe una dirección.',openMaps:'Abrir en Google Maps',teamDriver:'Conductor del equipo',route:'Ruta',inProgress:'En progreso',statusPublished:'Publicada',paused:'Pausada',issue:'Incidencia',draft:'Borrador',pending:'Pendiente',noTime:'Sin hora',today:'Hoy',normal:'Normal',priorityName:'Prioridad',urgent:'Urgente',pickup:'Recogida',delivery:'Entrega',transfer:'Ruta personalizada',return:'Regresar a sucursal',pickupFrom:'Recoger en / ubicación',deliveryTo:'Entregar a / dirección de entrega',contactPhone:'Teléfono del contacto',addToContacts:'Agregar a contactos',contactName:'Nombre del contacto',contactNamePlaceholder:'Ejemplo: Fox Electric',saveContact:'Guardar contacto',savingContact:'Guardando…',contactSaved:'Contacto guardado. Estará disponible la próxima vez.',contactAlreadyExists:'Este contacto ya existe.',contactSaveError:'No se pudo guardar el contacto.'},
  fr:{operations:'Opérations des itinéraires',title:'Itinéraires',subtitle:'Planifiez, organisez et publiez les itinéraires de votre équipe.',manage:'Gérer les itinéraires',add:'Ajouter un itinéraire',assigned:'Plan des itinéraires',assignedHelp:'Le travail du jour, les itinéraires programmés et terminés restent organisés ici.',active:'itinéraires',todaySection:'Aujourd’hui',upcomingSection:'À venir / programmés',inProgressSection:'En cours',completedSection:'Terminés aujourd’hui',completedStatus:'Terminé',tomorrow:'Demain',branch:'Succursale',destinationPending:'Destination en attente',noPo:'Sans PO',orderReference:'Référence de commande',viewManage:'Voir et gérer',empty:'Aucun itinéraire prévu aujourd’hui',emptyHelp:'Publiez le premier itinéraire de l’équipe pour aujourd’hui.',newAssignment:'Nouvelle affectation',create:'Créer un itinéraire',close:'Fermer le formulaire',chooseDestination:'Choisir une destination',routeType:'Type d’itinéraire',returnToBranch:'Retour à la succursale',returnHelp:'Utilise la succursale comme destination. Vous pouvez toujours choisir le point de départ.',driver:'Conducteur',chooseDriver:'Choisir un conducteur',startingPoint:'Point de départ',originPlaceholder:'Succursale ou adresse de départ',contactDestination:'Contact ou destination',searchPlaceholder:'Rechercher un contact ou saisir une adresse',searchHelp:'Saisissez une adresse pour afficher des suggestions ou choisissez un contact enregistré.',priority:'Priorité',date:'Date',time:'Heure',po:'PO ou numéro de commande',optional:'Facultatif',poExample:'Exemple : PO-45872',notes:'Notes',notesPlaceholder:'Instructions de livraison pour le conducteur',publish:'Publier l’itinéraire',publishing:'Publication...',published:'Itinéraire publié.',chooseRequired:'Choisissez un conducteur et saisissez une destination.',workspacePending:'L’espace entreprise n’est pas prêt. Actualisez et réessayez.',invalidDate:'Choisissez une date et une heure valides.',loadError:'Impossible de charger les itinéraires.',saveError:'Impossible d’enregistrer l’itinéraire.',preview:'Aperçu de l’itinéraire',previewHelp:'Choisissez un contact ou saisissez une adresse.',openMaps:'Ouvrir dans Google Maps',teamDriver:'Conducteur de l’équipe',route:'Itinéraire',inProgress:'En cours',statusPublished:'Publié',paused:'En pause',issue:'Incident',draft:'Brouillon',pending:'En attente',noTime:'Aucune heure',today:'Aujourd’hui',normal:'Normal',priorityName:'Priorité',urgent:'Urgent',pickup:'Collecte',delivery:'Livraison',transfer:'Itinéraire personnalisé',return:'Retour à la succursale',pickupFrom:'Collecter à / lieu',deliveryTo:'Livrer à / adresse de livraison',contactPhone:'Téléphone du contact',addToContacts:'Ajouter aux contacts',contactName:'Nom du contact',contactNamePlaceholder:'Exemple : Fox Electric',saveContact:'Enregistrer le contact',savingContact:'Enregistrement…',contactSaved:'Contact enregistré. Il sera disponible la prochaine fois.',contactAlreadyExists:'Ce contact existe déjà.',contactSaveError:'Impossible d’enregistrer le contact.'},
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
    stop_contact_name: '',
    contact_id: '',
    priority,
    order_number: '',
    notes: '',
    ...localSchedule(),
    driver_id: '',
    insert_before_id: '',
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
  if (status === 'completed') return c.completedStatus
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

function routeDateValue(route: RouteRecord) {
  return route.route_date || route.scheduled_at?.slice(0, 10) || ''
}

function routeDate(route: RouteRecord, locale:string, c:RouteCopy) {
  const value = routeDateValue(route)
  if (!value) return c.today
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return c.today
  const todayValue = localSchedule().date
  if (value === todayValue) return c.today
  const tomorrow = new Date(`${todayValue}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowValue = tomorrow.toISOString().slice(0, 10)
  const formatted = new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric'}).format(date)
  return value === tomorrowValue ? `${c.tomorrow}, ${formatted}` : formatted
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
  const [insertBeforeId, setInsertBeforeId] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState<GeocodedLocation | null>(null)
  const [pendingLocation, setPendingLocation] = useState<GeocodedLocation | null>(null)
  const [saveContactOpen, setSaveContactOpen] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [contactSaveMessage, setContactSaveMessage] = useState('')

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
        client.from('contacts').select('id,company_name,contact_name,address,phone,location_code,latitude,longitude,location_source,location_external_id').eq('company_id', membership.company_id).order('company_name'),
        assigneeQuery,
        client.from('routes').select('id,company_id,branch_id,driver_id,mission_type,priority,status,origin_name,origin_address,origin_lat,origin_lng,destination_name,destination_address,destination_lat,destination_lng,destination_location_source,destination_location_external_id,destination_phone,scheduled_at,route_date,position,notes,order_number').eq('company_id', membership.company_id).in('status', routeListStatuses).order('scheduled_at', {ascending:true, nullsFirst:false}).order('position', {ascending:true}),
        client.from('branches').select('id,name,address,primary_driver_id,latitude,longitude,location_source,location_external_id').eq('company_id', membership.company_id).order('name'),
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
        destination: contact?.address || requestedDestination || current.destination,
        destination_label: contact?.company_name || current.destination_label,
        destination_phone: contact?.phone || current.destination_phone,
        stop_contact_name: contact?.contact_name || current.stop_contact_name,
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
  const destinationSuggestions = useMemo<LocalAddressSuggestion[]>(() => [
    ...contacts.map(contact => {
      const coordinate=savedCoordinate(contact)
      return {
        id: `contact:${contact.id}`,
        primary: contact.location_code ? `${contact.location_code} · ${contact.company_name}` : contact.company_name,
        secondary: [contact.contact_name, contact.address].filter(Boolean).join(' · '),
        value: `${contact.company_name} - ${contact.address}`,
        location: coordinate ? {
          name: contact.company_name,
          formattedAddress: contact.address,
          coordinate,
          source: contact.location_source || 'routehub',
          externalId: contact.location_external_id || undefined,
        } satisfies GeocodedLocation : undefined,
      }
    }),
    ...branches.filter(branch => Boolean(branch.address)).map(branch => ({
      id: `branch:${branch.id}`,
      primary: branch.name,
      secondary: branch.address || '',
      value: `${branch.name} - ${branch.address}`,
      location: branchLocation(branch) || undefined,
    })),
  ], [branches, contacts])
  const previewAddress = selectedContact?.address || form.destination
  const oc = originCopy[locale]
  const defaultBranch = branches.find(branch => branch.id === branchId) || branches[0]
  const previousRoute = useMemo(() => routes
    .filter(route => route.driver_id === form.driver_id && route.route_date === form.date)
    .sort((a,b) => Number(b.position || 0) - Number(a.position || 0))[0], [routes, form.driver_id, form.date])
  const branchForValue = (value:string) => branches.find(branch => (branch.address || branch.name) === value) || null
  const originBranch = originMode === 'branch' ? branchForValue(form.origin) || defaultBranch : null
  const returnBranch = form.type === 'return' ? branchForValue(form.destination) || defaultBranch : null
  const selectedDriverGps = storedCoordinate(driverLocations[form.driver_id])
  const previousDestinationCoordinate = sanitizeCoordinate({lat:previousRoute?.destination_lat,lng:previousRoute?.destination_lng})
  const originBranchCoordinate = savedCoordinate(originBranch)
  const returnBranchCoordinate = savedCoordinate(returnBranch)
  const searchContext = defaultBranch?.address || ''
  const todayValue = localSchedule().date
  const routeSort = (left: RouteRecord, right: RouteRecord) => Number(left.position || 0) - Number(right.position || 0) || String(left.scheduled_at || '').localeCompare(String(right.scheduled_at || '')) || left.id.localeCompare(right.id)
  const todayRoutes = useMemo(() => routes
    .filter(route => (!routeDateValue(route) || routeDateValue(route) === todayValue) && !['completed', 'issue', 'cancelled'].includes(route.status || ''))
    .sort(routeSort), [routes, todayValue])
  const inProgressRoutes = useMemo(() => todayRoutes.filter(route => ['active', 'paused'].includes(route.status || '')), [todayRoutes])
  const scheduledTodayRoutes = useMemo(() => todayRoutes.filter(route => !['active', 'paused'].includes(route.status || '')), [todayRoutes])
  const issueTodayRoutes = useMemo(() => routes
    .filter(route => (!routeDateValue(route) || routeDateValue(route) === todayValue) && route.status === 'issue')
    .sort(routeSort), [routes, todayValue])
  const upcomingRoutes = useMemo(() => routes
    .filter(route => routeDateValue(route) > todayValue && !['completed', 'issue', 'cancelled'].includes(route.status || ''))
    .sort((left, right) => routeDateValue(left).localeCompare(routeDateValue(right)) || routeSort(left, right)), [routes, todayValue])
  const completedTodayRoutes = useMemo(() => routes
    .filter(route => (!routeDateValue(route) || routeDateValue(route) === todayValue) && route.status === 'completed')
    .sort(routeSort), [routes, todayValue])
  const planningMapRoutes = useMemo(() => {
    // The planning preview is scoped to today's operational routes. Future
    // routes remain available in their own scheduled section and must not
    // affect today's map or marker numbering. Legacy rows without a date or
    // branch remain visible for backwards compatibility.
    const configured = routes
      .filter(route => {
        const date = routeDateValue(route)
        const today = !date || date === todayValue
        const branch = !branchId || !route.branch_id || route.branch_id === branchId
        const operational = ['published', 'pending', 'active', 'paused', 'issue', 'draft'].includes(route.status || '')
        return today && branch && operational
      })
      .map(route => ({id: route.id, mission_type: route.mission_type, origin_address: route.origin_address, origin_lat: route.origin_lat, origin_lng: route.origin_lng, destination_address: route.destination_address, destination_name: route.destination_name, destination_lat: route.destination_lat, destination_lng: route.destination_lng, status: route.status, driver_id: route.driver_id, position: route.position}))
    if(form.destination.trim()) {
      const origin=originMode === 'branch' ? originBranchCoordinate : originMode === 'previous' ? previousDestinationCoordinate : originMode === 'custom' ? selectedDriverGps : null
      const destination=form.type === 'return' ? returnBranchCoordinate : sanitizeCoordinate(selectedDestinationLocation?.coordinate || {lat:selectedContact?.latitude,lng:selectedContact?.longitude})
      configured.push({
        id:'draft-preview',
        mission_type:form.type,
        origin_address:originBranch?.address || form.origin,
        origin_lat:origin?.lat ?? null,
        origin_lng:origin?.lng ?? null,
        destination_address:returnBranch?.address || form.destination,
        destination_name:returnBranch?.name || form.destination_label || selectedContact?.company_name || form.destination,
        destination_lat:destination?.lat ?? null,
        destination_lng:destination?.lng ?? null,
        status:'pending',
        driver_id:form.driver_id || null,
        position:configured.length + 1,
      })
    }
    return configured
  }, [branchId, form.destination, form.destination_label, form.driver_id, form.origin, form.type, originBranch?.address, originBranchCoordinate, originMode, previousDestinationCoordinate, returnBranch?.address, returnBranch?.name, returnBranchCoordinate, routes, selectedContact?.company_name, selectedContact?.latitude, selectedContact?.longitude, selectedDestinationLocation, selectedDriverGps, todayValue])

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
      const code = item.location_code?.toLowerCase() || ''
      return option === normalized || code === normalized || item.company_name.toLowerCase() === normalized || item.address.toLowerCase() === normalized
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
        stop_contact_name: contact?.contact_name || (replacingSavedContact ? '' : current.stop_contact_name),
      }
    })
    if (selectedDestinationLocation && value.trim() !== selectedDestinationLocation.formattedAddress && value.trim() !== selectedDestinationLocation.name) setSelectedDestinationLocation(null)
    setPendingLocation(null)
  }

  const selectDestinationContact = (suggestion: LocalAddressSuggestion) => {
    const contactId = suggestion.id.startsWith('contact:') ? suggestion.id.slice('contact:'.length) : ''
    const branch = suggestion.id.startsWith('branch:') ? branches.find(item => item.id === suggestion.id.slice('branch:'.length)) : undefined
    const contact = contacts.find(item => item.id === contactId)
    setForm(current => ({
      ...current,
      destination: contact?.address || branch?.address || suggestion.value,
      contact_id: contact?.id || '',
      destination_label: branch?.name || '',
      destination_phone: contact?.phone || '',
      stop_contact_name: contact?.contact_name || '',
    }))
    setSelectedDestinationLocation(suggestion.location || null)
    setPendingLocation(null)
  }

  const selectExternalDestination = (suggestion: AddressSearchSuggestion) => {
    setPendingLocation({
      name: suggestion.name || suggestion.primary,
      formattedAddress: suggestion.label,
      coordinate: suggestion.coordinate || {lat: 0, lng: 0},
      source: suggestion.source,
      externalId: suggestion.externalId,
    })
  }

  const useConfirmedDestination = () => {
    if (!pendingLocation || pendingLocation.coordinate.lat === 0 || pendingLocation.coordinate.lng === 0) return
    setSelectedDestinationLocation(pendingLocation)
    setForm(current => ({
      ...current,
      destination: pendingLocation.formattedAddress,
      destination_label: pendingLocation.name || '',
      destination_phone: '',
      contact_id: '',
    }))
    setPendingLocation(null)
  }

  const saveDestinationAsContact = async () => {
    const address = (selectedDestinationLocation?.formattedAddress || form.destination).trim()
    const name = newContactName.trim()
    if (!address || !name || !companyId || savingContact) return
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()
    const duplicate = contacts.find(contact => normalize(contact.company_name) === normalize(name) && normalize(contact.address) === normalize(address))
    if (duplicate) {
      setForm(current => ({...current, contact_id: duplicate.id, destination: duplicate.address, destination_label: duplicate.company_name, destination_phone: duplicate.phone || ''}))
      setSaveContactOpen(false)
      setContactSaveMessage(c.contactAlreadyExists)
      return
    }
    setSavingContact(true)
    setContactSaveMessage('')
    try {
      const client = getSupabase()
      const {data, error} = await client.from('contacts').insert({
        company_id: companyId,
        branch_id: branchId,
        company_name: name,
        contact_name: null,
        address,
        phone: form.destination_phone.trim() || null,
        latitude: selectedDestinationLocation?.coordinate.lat ?? null,
        longitude: selectedDestinationLocation?.coordinate.lng ?? null,
        location_source: selectedDestinationLocation?.source || 'routehub',
        location_external_id: selectedDestinationLocation?.externalId || null,
      }).select('id,company_name,contact_name,address,phone,location_code,latitude,longitude,location_source,location_external_id').single()
      if (error) throw error
      if (!data) throw new Error('Contact could not be saved')
      const contact = data as Contact
      setContacts(current => [...current, contact].sort((a, b) => a.company_name.localeCompare(b.company_name)))
      setForm(current => ({...current, contact_id: contact.id, destination: contact.address, destination_label: contact.company_name, destination_phone: contact.phone || ''}))
      setSaveContactOpen(false)
      setNewContactName('')
      setContactSaveMessage(c.contactSaved)
    } catch (error) {
      console.error(error)
      setContactSaveMessage(c.contactSaveError)
    } finally {
      setSavingContact(false)
    }
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
    setSelectedDestinationLocation(null)
    setPendingLocation(null)
    setSaveContactOpen(false)
    setNewContactName('')
    setContactSaveMessage('')
    setInsertBeforeId('')
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
      const destinationPhone = form.destination_phone.trim() || selected?.phone || null
      const destinationContactName = form.stop_contact_name.trim() || selected?.contact_name || null
      const originCoordinate = originMode === 'branch'
        ? originBranchCoordinate
        : originMode === 'previous'
          ? previousDestinationCoordinate
          : originMode === 'custom'
            ? selectedDriverGps
            : null
      const destinationCoordinate = form.type === 'return'
        ? returnBranchCoordinate
        : sanitizeCoordinate(selectedDestinationLocation?.coordinate) || savedCoordinate(selected)
      const persistedDestinationAddress = form.type === 'return' ? returnBranch?.address || returnBranch?.name || destinationAddress : destinationAddress
      const persistedDestinationName = form.type === 'return' ? returnBranch?.name || destinationName : destinationName

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

      let queueQuery = client.from('routes')
        .select('id,position,destination_name,mission_type,status')
        .eq('company_id', companyId)
        .eq('driver_id', form.driver_id)
        .eq('route_date', form.date)
        .in('status', ['draft','pending','published','paused'])
        .order('position', {ascending: true})
      queueQuery = branchId ? queueQuery.eq('branch_id', branchId) : queueQuery.is('branch_id', null)
      const {data: lastQueue, error: queueError} = await queueQuery
      if (queueError) throw queueError

      const payload: Record<string, unknown> = {
        company_id: companyId,
        branch_id: branchId,
        driver_id: form.driver_id,
        route_date: form.date,
        mode: 'flexible',
        status: 'published',
        mission_type: form.type,
        origin_name: originMode === 'branch' ? originBranch?.name || c.branch : originMode === 'previous' ? previousRoute?.destination_name || form.origin.trim() : contacts.find(contact => contact.address === form.origin)?.company_name || form.origin.trim(),
        origin_address: originBranch?.address || form.origin.trim() || defaultBranch?.address || defaultBranch?.name || c.branch,
        origin_lat: originCoordinate?.lat ?? null,
        origin_lng: originCoordinate?.lng ?? null,
        destination_name: persistedDestinationName,
        destination_address: persistedDestinationAddress,
        destination_lat: destinationCoordinate?.lat ?? null,
        destination_lng: destinationCoordinate?.lng ?? null,
        destination_location_source: form.type === 'return' ? returnBranch?.location_source || 'routehub' : selectedDestinationLocation?.source || selected?.location_source || null,
        destination_location_external_id: form.type === 'return' ? returnBranch?.location_external_id || null : selectedDestinationLocation?.externalId || selected?.location_external_id || null,
        destination_phone: destinationPhone,
        priority: form.priority,
        order_number: form.order_number.trim() || null,
        notes: form.notes.trim() || null,
        scheduled_at: scheduledAt,
        position: Number(lastRoute?.position || 0) + 1,
      }
      if (destinationContactName) payload.destination_contact_name = destinationContactName
      let created = await client.from('routes').insert(payload).select('id').single()
      if (created.error && /destination_contact_name|schema cache|column/i.test(created.error.message || '')) {
        delete payload.destination_contact_name
        created = await client.from('routes').insert(payload).select('id').single()
      }
      const {data: createdRoute, error} = created
      if (error) throw error

      // New work is appended first, then atomically inserted before the
      // selected upcoming stop. The RPC keeps the active/completed history
      // untouched and recalculates origins for the remaining queue.
      if (createdRoute?.id) {
        const mutableIds = (lastQueue || []).map(route => route.id)
        const insertionIndex = insertBeforeId ? mutableIds.indexOf(insertBeforeId) : -1
        const nextIds = mutableIds.filter(id => id !== createdRoute.id)
        if (insertionIndex >= 0) nextIds.splice(insertionIndex, 0, createdRoute.id)
        else nextIds.push(createdRoute.id)
        if (nextIds.length) {
          const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: nextIds})
          if (reorderError) throw reorderError
        }
      }

      if (createdRoute?.id && currentUserId) {
        await recordActivity({companyId,userId:currentUserId,action:'route_created',recordId:createdRoute.id,after:{driver_id:form.driver_id,priority:form.priority,destination:destinationAddress}}).catch(()=>undefined)
        void sendRoutePush(createdRoute.id, 'assigned')
      }
      window.dispatchEvent(new Event('routehub:notifications-refresh'))

      const requestId = searchParams.get('request')
      if (requestId) {
        const {error: requestError} = await client.from('requests').update({status:'assigned'}).eq('id', requestId).eq('company_id', companyId)
        if (requestError) throw requestError
      }

      setForm(current => ({...initialForm(), driver_id: current.driver_id}))
      setSelectedDestinationLocation(null)
      setInsertBeforeId('')
      await loadWorkspace()
      setMessage(c.published)
      setJustCreated(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      setSaving(false)
    }
  }

  const renderRouteCards = (items: RouteRecord[]) => items.map((route, index) => {
    const details = driverDetails(route.driver_id ? driverIndex.get(route.driver_id) : undefined,c.teamDriver)
    const origin = route.origin_name || route.origin_address || c.branch
    const destination = route.destination_name || route.destination_address || c.destinationPending
    const priority = route.priority || 'normal'
    const status = route.status || 'pending'
    const statusTone = status === 'completed' ? styles.routeToneCompleted : status === 'issue' ? styles.routeToneIssue : status === 'cancelled' ? styles.routeToneCancelled : ['active','paused'].includes(status) ? styles.routeToneActive : styles.routeTonePending
    return <article className={`${styles.routeCard} ${statusTone} ${priority === 'urgent' ? styles.urgentCard : ''}`} key={route.id}>
      <div className={styles.cardTop}>
        <div className={styles.routeIdentity}><span className={styles.routeNumber}>{String(route.position || index + 1).padStart(2, '0')}</span><div><small className={`${styles.routeTypeLabel} ${styles[`routeType_${route.mission_type}`] || ''}`}>{typeLabel(route.mission_type,c)}</small><strong>{destination}</strong></div></div>
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
  })

  const priorityRoutes = routes.filter(route => route.driver_id === form.driver_id && route.route_date === form.date && ['draft','pending','published','paused'].includes(route.status || '')).sort(routeSort)
  const selectedDriver = drivers.find(driver => driver.user_id === form.driver_id)
  const selectedDriverName = selectedDriver ? driverDetails(selectedDriver, c.teamDriver).name : c.chooseDriver

  return <ManagerShell active="routes" branchName={defaultBranch?.name} roleLabel={t.managerRole}>
    <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{c.operations.toUpperCase()}</p>
        <h1>{c.title}</h1>
        <p>{c.subtitle}</p>
      </div>
      <div className={styles.headerActions}>
        <Link className={styles.secondaryButton} href="/routes/live"><MapPin size={18}/>{locale==='es'?'Mapa en vivo':locale==='fr'?'Carte en direct':'Live map'}</Link>
        <Link className={styles.secondaryButton} href="/contacts"><Users size={18}/>{t.contacts}</Link>
        <Link className={styles.secondaryButton} href="/routes/manage?reorder=1"><RouteIcon size={18}/>{c.manage}</Link>
        <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
      </div>
    </header>

    {message && <div className={message.includes('successfully') ? styles.successMessage : styles.message} role="status">{message}</div>}

    <section className={styles.listHeading}>
      <div><h2>{c.assigned}</h2><p>{c.assignedHelp}</p></div>
      {!loading && <span>{todayRoutes.length} {c.active}</span>}
    </section>

    {loading ? <section className={styles.routeGrid} aria-label={c.loadError}>
      {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
    </section> : <>
      {inProgressRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.inProgressSection}</h2><span>{inProgressRoutes.length} {c.active}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(inProgressRoutes)}</section>
      </section>}

      <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.todaySection}</h2><span>{todayRoutes.length} {c.active}</span></div>
        {scheduledTodayRoutes.length ? <section className={styles.routeGrid}>{renderRouteCards(scheduledTodayRoutes)}</section> : <section className={styles.emptyState}><div><RouteIcon size={28}/></div><h2>{c.empty}</h2><p>{c.emptyHelp}</p><button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button></section>}
      </section>

      {upcomingRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.upcomingSection}</h2><span>{upcomingRoutes.length} {c.active}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(upcomingRoutes)}</section>
      </section>}

      {completedTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.completedSection}</h2><span>{completedTodayRoutes.length} {c.active}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(completedTodayRoutes)}</section>
      </section>}

      {issueTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.issue}</h2><span>{issueTodayRoutes.length}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(issueTodayRoutes)}</section>
      </section>}
    </>}

    {open && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false) }}>
      <section className={styles.builder} role="dialog" aria-modal="true" aria-labelledby="new-route-title">
        <div className={`${styles.builderHeader} ${contrast.header}`}>
          <div><p className={styles.eyebrow}>{c.newAssignment.toUpperCase()}</p><h2 id="new-route-title">{locale==='es' ? 'Nueva ruta' : locale==='fr' ? 'Nouvel itinéraire' : 'New route'}</h2><p className={styles.builderSubtitle}>{locale==='es' ? 'Crea una recogida o entrega en pocos pasos.' : locale==='fr' ? 'Créez une collecte ou une livraison en quelques étapes.' : 'Create a pickup or delivery in a few steps.'}</p></div>
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
          <button type="button" className={styles.mobileMapButton} onClick={() => setPreviewOpen(value => !value)}><MapPin size={16}/>{previewOpen ? (locale==='es' ? 'Ocultar mapa' : locale==='fr' ? 'Masquer la carte' : 'Hide map') : (locale==='es' ? 'Ver mapa' : locale==='fr' ? 'Voir la carte' : 'View map')}</button>
          <div className={`${styles.mapColumn} ${previewOpen ? styles.mapColumnOpen : ''}`}>
            <section className={styles.previewCard} aria-label={locale==='es' ? 'Vista previa de la ruta' : locale==='fr' ? 'Aperçu de l’itinéraire' : 'Route preview'}>
              <div className={styles.previewCardHeader}>
                <div><span className={styles.previewEyebrow}>{locale==='es' ? 'VISTA PREVIA' : locale==='fr' ? 'APERÇU' : 'ROUTE PREVIEW'}</span><h3>{locale==='es' ? 'Confirma las ubicaciones' : locale==='fr' ? 'Confirmez les emplacements' : 'Confirm locations'}</h3></div>
                <MapPin size={19}/>
              </div>
              <OperationsMap routes={planningMapRoutes} locale={locale} interactive/>
              <div className={styles.previewSummary}><span><i>S</i>{planningMapRoutes[0]?.origin_address || defaultBranch?.address || c.branch}</span><span><i>1</i>{planningMapRoutes.length ? `${planningMapRoutes.length} ${locale==='es'?'rutas configuradas':locale==='fr'?'itinéraires configurés':'configured routes'}` : (locale==='es' ? 'Sin rutas configuradas' : locale==='fr' ? 'Aucun itinéraire configuré' : 'No configured routes')}</span></div>
            </section>
            <section className={styles.assignmentSummary} aria-label={locale==='es' ? 'Resumen de asignación' : locale==='fr' ? 'Résumé de l’affectation' : 'Assignment summary'}>
              <div className={styles.summaryHeader}><h3>{locale==='es' ? 'Resumen de asignación' : locale==='fr' ? 'Résumé de l’affectation' : 'Assignment summary'}</h3><RouteIcon size={18}/></div>
              <dl className={styles.summaryGrid}>
                <div><dt>{c.routeType}</dt><dd>{typeLabel(form.type,c)}</dd></div>
                <div><dt>{c.driver}</dt><dd>{selectedDriverName}</dd></div>
                <div><dt>{locale==='es' ? 'Posición' : locale==='fr' ? 'Position' : 'Position'}</dt><dd>{insertBeforeId ? (locale==='es' ? 'Antes de una parada' : locale==='fr' ? 'Avant un arrêt' : 'Before a stop') : (locale==='es' ? 'Al final' : locale==='fr' ? 'À la fin' : 'At the end')}</dd></div>
                <div><dt>{c.date} · {c.time}</dt><dd>{form.date || '—'}{form.time ? ` · ${form.time}` : ''}</dd></div>
              </dl>
              <div className={styles.summaryLocations}><div><span>{locale==='es' ? 'INICIO' : locale==='fr' ? 'DÉPART' : 'START'}</span><strong>{form.origin || defaultBranch?.address || c.branch}</strong></div><div><span>{locale==='es' ? 'OPERACIÓN' : locale==='fr' ? 'OPÉRATION' : 'OPERATION'}</span><strong>{form.destination_label || form.destination || (form.type==='return' ? c.branch : c.destinationPending)}</strong></div></div>
            </section>
          </div>

          <div className={`${styles.formColumn} ${contrast.form}`}>
            <section className={styles.builderSection}>
            <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>1</span><div><h3>{locale==='es' ? 'Asignación' : locale==='fr' ? 'Affectation' : 'Assignment'}</h3><p>{locale==='es' ? 'Elige el tipo de operación y el conductor.' : locale==='fr' ? 'Choisissez le type d’opération et le conducteur.' : 'Choose the operation type and driver.'}</p></div></div>
            <fieldset className={`${styles.fieldset} ${styles.primaryRouteTypes}`}>
              <legend>{c.routeType}</legend>
              <div className={styles.segmented}>{routeTypes.map(type => <button className={form.type === type.value ? styles.segmentActive : ''} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => {
                if(type.value === 'return') {
                  setSelectedDestinationLocation(branchLocation(defaultBranch))
                  setForm(current => ({...current, type:'return', destination:defaultBranch?.address || defaultBranch?.name || '', destination_label:defaultBranch?.name||'', destination_phone:'', contact_id:''}))
                  return
                }
                setForm(current => ({...current, type:type.value}))
              }}>{typeLabel(type.value,c)}</button>)}</div>
            </fieldset>

            {selectedContact && <section className={styles.selectedContactCard} aria-label={locale==='es' ? 'Contacto seleccionado' : locale==='fr' ? 'Contact sélectionné' : 'Selected contact'}>
              <div className={styles.selectedContactIcon}><Users size={18}/></div>
              <div className={styles.selectedContactInfo}><strong>{selectedContact.company_name}</strong><span>{selectedContact.address}</span>{selectedContact.phone && <small>{selectedContact.phone}</small>}</div>
              <button type="button" className={styles.selectedContactChange} onClick={() => setForm(current => ({...current, contact_id:'', destination:'', destination_label:'', destination_phone:''}))}>{locale==='es' ? 'Cambiar' : locale==='fr' ? 'Modifier' : 'Change'}</button>
            </section>}

            <label className={`${styles.field} ${styles.driverField}`}><span>{c.driver}</span><div className={styles.inputWrap}><UserRound size={18}/><select value={form.driver_id} onChange={event => setForm(current => ({...current, driver_id: event.target.value}))}><option value="">{c.chooseDriver}</option>{drivers.map((driver,index) => { const fallback=`${c.driver} ${index+1}`; const details = driverDetails(driver,driver.role==='driver'?c.teamDriver:fallback); const isPrimary=driver.user_id===defaultBranch?.primary_driver_id; const roleName=isPrimary?(locale==='es'?'Conductor principal':locale==='fr'?'Conducteur principal':'Primary Driver'):(driver.role||c.teamDriver).replaceAll('_',' '); return <option key={driver.user_id} value={driver.user_id}>{`${isPrimary?'★ ':''}${details.name||fallback} — ${roleName}`}</option> })}</select></div></label>

            {form.driver_id && form.date === todayValue && priorityRoutes.length > 0 && <label className={styles.field}><span>{locale==='es' ? 'Posición en la ruta' : locale==='fr' ? 'Position dans l’itinéraire' : 'Position in route'} <em>{c.optional}</em></span><div className={styles.inputWrap}><RouteIcon size={18}/><select value={insertBeforeId} onChange={event => setInsertBeforeId(event.target.value)}><option value="">{locale==='es' ? 'Agregar al final' : locale==='fr' ? 'Ajouter à la fin' : 'Add to end'}</option>{priorityRoutes.map(route => <option key={route.id} value={route.id}>{locale==='es' ? `Antes de ${route.destination_name || route.destination_address || 'la próxima parada'}` : locale==='fr' ? `Avant ${route.destination_name || route.destination_address || 'la prochaine étape'}` : `Before ${route.destination_name || route.destination_address || 'next stop'}`}</option>)}</select></div></label>}

            </section>

            <section className={styles.builderSection}>
            <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>2</span><div><h3>{locale==='es' ? 'Programación' : locale==='fr' ? 'Planification' : 'Schedule'}</h3><p>{locale==='es' ? 'Elige cuándo ocurrirá esta asignación.' : locale==='fr' ? 'Choisissez quand cette affectation aura lieu.' : 'Choose when this assignment should happen.'}</p></div></div>
            <div className={styles.splitFields}>
              <label className={styles.field}><span>{c.date}</span><div className={styles.inputWrap}><CalendarDays size={18}/><input type="date" value={form.date} onChange={event => setForm(current => ({...current, date: event.target.value}))}/></div></label>
              <label className={styles.field}><span>{c.time}</span><div className={styles.inputWrap}><Clock3 size={18}/><input type="time" value={form.time} onChange={event => setForm(current => ({...current, time: event.target.value}))}/></div></label>
            </div>

            </section>

            <section className={styles.builderSection}>
            <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>3</span><div><h3>{locale==='es' ? 'Ubicaciones' : locale==='fr' ? 'Emplacements' : 'Locations'}</h3><p>{locale==='es' ? 'Define el inicio y el destino.' : locale==='fr' ? 'Définissez le départ et la destination.' : 'Set the starting point and destination.'}</p></div></div>
            <fieldset className={styles.fieldset}>
              <legend>{c.startingPoint}</legend>
              <div className={styles.segmented}>{(['branch','previous','custom'] as OriginMode[]).map(mode => <button className={originMode === mode ? styles.segmentActive : ''} type="button" key={mode} aria-pressed={originMode === mode} onClick={() => setOriginSource(mode)}>{oc[mode]}</button>)}</div>
              {originMode === 'branch' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm(current => ({...current, origin:event.target.value}))}><option value="">{oc.chooseBranch}</option>{branches.map(branch => <option key={branch.id} value={branch.address || branch.name}>{branch.name}{branch.address ? ` - ${branch.address}` : ''}</option>)}</select></div>}
              {originMode === 'previous' && <div className={styles.inputWrap}><MapPin size={18}/><input value={form.origin} onChange={event => setForm(current => ({...current, origin:event.target.value}))} placeholder={oc.noPrevious}/></div>}
              {originMode === 'contact' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm(current => ({...current, origin:event.target.value}))}><option value="">{oc.chooseContact}</option>{contacts.map(contact => <option key={contact.id} value={contact.address}>{contact.company_name} - {contact.address}</option>)}</select></div>}
              {originMode === 'custom' && <div className={styles.inputWrap}><MapPin size={18}/><GoogleAddressInput value={form.origin} placeholder={c.originPlaceholder} onValueChange={value => setForm(current => ({...current, origin:value}))}/></div>}
            </fieldset>

            {form.type==='return' ? <label className={styles.field}><span>{locale==='es'?'Sucursal de regreso':locale==='fr'?'Succursale de retour':'Return branch'}</span><div className={styles.inputWrap}><MapPin size={18}/><select value={form.destination} onChange={event=>{const branch=branchForValue(event.target.value);setSelectedDestinationLocation(branchLocation(branch));setForm(current=>({...current,destination:event.target.value,destination_label:branch?.name||'',destination_phone:'',contact_id:''}))}}>{branches.map(branch=><option key={branch.id} value={branch.address||branch.name}>{branch.name}{branch.address?` — ${branch.address}`:''}</option>)}</select></div></label> : <>
              <label className={styles.field}>
                <span>{form.type==='pickup'?c.pickupFrom:c.deliveryTo}</span>
                <div className={styles.inputWrap}><Search size={18}/><GoogleAddressInput value={form.destination} placeholder={c.searchPlaceholder} onValueChange={updateDestination} localSuggestions={destinationSuggestions} onSelectLocalSuggestion={selectDestinationContact} onSelectSearchSuggestion={selectExternalDestination} searchContext={searchContext} searchLabel={locale==='es'?'Buscar':locale==='fr'?'Rechercher':'Search'}/></div>
                <small>{c.searchHelp}</small>
              </label>
              {pendingLocation && <section className={styles.locationConfirmation} aria-live="polite">
                <div><p>{locale==='es'?'Confirmar ubicación':locale==='fr'?'Confirmer le lieu':'Confirm location'}</p><strong>{pendingLocation.name || pendingLocation.formattedAddress}</strong><span>{pendingLocation.formattedAddress}</span></div>
                <LocationConfirmMap coordinate={pendingLocation.coordinate} label={pendingLocation.name || pendingLocation.formattedAddress} onCoordinateChange={coordinate => setPendingLocation(current => current ? {...current, coordinate} : current)}/>
                <small>{locale==='es'?'Toca el mapa o arrastra el pin para corregirlo.':locale==='fr'?'Touchez la carte ou faites glisser le repère pour le corriger.':'Tap the map or drag the pin to adjust it.'}</small>
                <div className={styles.locationConfirmationActions}><button type="button" className={styles.secondaryButton} onClick={() => setPendingLocation(null)}>{locale==='es'?'Cambiar':locale==='fr'?'Modifier':'Change'}</button><button type="button" className={styles.primaryButton} onClick={useConfirmedDestination}>{locale==='es'?'Usar esta ubicación':locale==='fr'?'Utiliser ce lieu':'Use this location'}</button></div>
              </section>}
              {!selectedContact && !pendingLocation && form.destination.trim() && <div className={styles.addContactBlock}>
                {!saveContactOpen ? <button type="button" className={styles.addContactButton} onClick={() => {setSaveContactOpen(true);setContactSaveMessage('')}}><UserPlus size={17}/>{c.addToContacts}</button> : <div className={styles.saveContactPanel}>
                  <div className={styles.saveContactHeader}><strong>{c.addToContacts}</strong><button type="button" onClick={() => setSaveContactOpen(false)} aria-label={c.close}>×</button></div>
                  <label className={styles.field}><span>{c.contactName}</span><input autoComplete="organization" value={newContactName} placeholder={c.contactNamePlaceholder} onChange={event => setNewContactName(event.target.value)}/></label>
                  <div className={styles.saveContactActions}><button type="button" className={styles.secondaryButton} onClick={() => setSaveContactOpen(false)}>{locale==='es'?'Cancelar':locale==='fr'?'Annuler':'Cancel'}</button><button type="button" className={styles.primaryButton} disabled={!newContactName.trim() || savingContact} onClick={() => void saveDestinationAsContact()}><UserPlus size={16}/>{savingContact ? c.savingContact : c.saveContact}</button></div>
                </div>}
              </div>}
              {contactSaveMessage && <small className={styles.contactSaveMessage} role="status">{contactSaveMessage}</small>}
              {form.type==='pickup'&&<label className={styles.field}><span>{c.po}</span><input value={form.order_number} placeholder={c.poExample} onChange={event => setForm(current => ({...current, order_number:event.target.value}))}/></label>}
            </>}
            </section>

            <section className={styles.builderSection}>
            <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>4</span><div><h3>{locale==='es' ? 'Más detalles' : locale==='fr' ? 'Plus de détails' : 'More details'}</h3><p>{locale==='es' ? 'Información opcional para el conductor.' : locale==='fr' ? 'Informations facultatives pour le conducteur.' : 'Optional information for the driver.'}</p></div></div>
            {form.type==='return'&&<label className={styles.field}><span>{c.notes} <em>{c.optional}</em></span><textarea rows={2} value={form.notes} placeholder={locale==='es'?'Ejemplo: Recoger material para la próxima entrega':locale==='fr'?'Exemple : récupérer le matériel pour la prochaine livraison':'Example: Pick up material for next delivery'} onChange={event => setForm(current => ({...current, notes:event.target.value}))}/></label>}

            {form.type!=='return'&&<button className={styles.detailsToggle} type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}><SlidersHorizontal size={17}/>{locale==='es' ? 'Más detalles' : locale==='fr' ? 'Plus de détails' : 'More details'}<ChevronRight size={16} className={detailsOpen ? styles.detailsChevronOpen : ''}/></button>}

            {detailsOpen && form.type!=='return' && <div className={styles.optionalDetails}>
              {form.type!=='pickup'&&<label className={styles.field}><span>{locale==='es'?'Job / número de orden':locale==='fr'?'Chantier / numéro de commande':'Job / order number'} <em>{c.optional}</em></span><input value={form.order_number} placeholder={c.poExample} onChange={event => setForm(current => ({...current, order_number: event.target.value}))}/></label>}
              <label className={styles.field}><span>{form.type==='delivery'?(locale==='es'?'Instrucciones de entrega':locale==='fr'?'Instructions de livraison':'Delivery instructions'):c.notes} <em>{c.optional}</em></span><textarea rows={3} value={form.notes} placeholder={form.type==='delivery'?c.notesPlaceholder:c.notes} onChange={event => setForm(current => ({...current, notes: event.target.value}))}/></label>
              <label className={styles.field}>
                <span>{locale==='es'?'Otra persona en esta ruta':locale==='fr'?'Autre personne pour cet itinéraire':'Different person on this route'} <em>{c.optional}</em></span>
                <input value={form.stop_contact_name} placeholder={selectedContact?.contact_name || (locale==='es'?'Solo si no es el contacto guardado':locale==='fr'?'Seulement si ce n’est pas le contact enregistré':'Only if not the saved contact')} onChange={event=>setForm(current=>({...current,stop_contact_name:event.target.value}))}/>
              </label>
              <label className={styles.field}>
                <span>{locale==='es'?'Teléfono de esta ruta':locale==='fr'?'Téléphone de cet itinéraire':'Phone for this route'} <em>{c.optional}</em></span>
                <input type="tel" value={form.destination_phone} placeholder={selectedContact?.phone || ''} onChange={event=>setForm(current=>({...current,destination_phone:event.target.value}))}/>
              </label>
            </div>}
            </section>

            <div className={styles.builderFooter}>
              <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => setOpen(false)}>{locale==='es' ? 'Cancelar' : locale==='fr' ? 'Annuler' : 'Cancel'}</button>
              <button className={styles.publishButton} type="button" disabled={saving || !form.driver_id || !form.destination.trim()} onClick={save}>{saving ? <><span className={styles.spinner}/>{c.publishing}</> : <><Truck size={19}/>{c.publish}</>}</button>
            </div>
          </div>
        </div>}
      </section>
    </div>}
    </div>
  </ManagerShell>
}
