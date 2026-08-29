export type DriverV3Route = {
  id: string
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
  order_number?: string | null
  arrived_at?: string | null
  completed_at?: string | null
  route_started_at?: string | null
  route_completed_at?: string | null
}

export type CurrentOperation = {
  route: DriverV3Route
  kind: 'pickup' | 'delivery' | 'branch'
  total: number
  completed: number
}
