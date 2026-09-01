export type DriverV3Route = {
  id: string
  route_number?: string | null
  driver_id?: string | null
  route_date?: string | null
  status: string
  position: number
  mission_type?: string | null
  destination_name?: string | null
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
  destination_phone?: string | null
  destination_contact_name?: string | null
  order_number?: string | null
  arrived_at?: string | null
  completed_at?: string | null
  route_started_at?: string | null
  route_completed_at?: string | null
  completion_photo_path?: string | null
  customer_signature_path?: string | null
  finalized_at?: string | null
  driver_note?: string | null
  company_id?: string
}

export type CurrentOperation = {
  route: DriverV3Route
  kind: 'pickup' | 'delivery' | 'branch'
  total: number
  completed: number
}
