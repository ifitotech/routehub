import {currentMembership} from './data'
import {operationalDate} from './driver-queue'
import {getSupabase} from './supabase'
import {
  selectManagerDashboard,
  type DashboardDriver,
  type DashboardRequest,
  type DashboardRoute,
  type DashboardSummary,
  type ManagerDashboardData,
  type ManagerDashboardScope,
} from './manager-dashboard'

export type {DashboardRoute, DashboardSummary, ManagerDashboardData, ManagerDashboardScope} from './manager-dashboard'

/**
 * RouteHub currently has no company/branch timezone setting. The browser's
 * local calendar is therefore the operational clock, matching Driver Mode.
 * route_date is a PostgreSQL DATE and is compared as YYYY-MM-DD; it must not
 * be converted through UTC.
 */
export function managerOperationalDate(now: Date = new Date()) {
  return operationalDate(now)
}

export async function loadManagerDashboard(scope: ManagerDashboardScope): Promise<ManagerDashboardData> {
  const client = getSupabase()

  let routeQuery = client.from('routes')
    .select('id,company_id,branch_id,route_date,mission_type,origin_address,origin_lat,origin_lng,destination_name,destination_address,destination_lat,destination_lng,order_number,status,driver_id,position')
    .eq('company_id', scope.companyId)
    .eq('route_date', scope.routeDate)
  let requestQuery = client.from('requests')
    .select('company_id,branch_id,status')
    .eq('company_id', scope.companyId)

  if (scope.branchId) {
    routeQuery = routeQuery.eq('branch_id', scope.branchId)
    requestQuery = requestQuery.eq('branch_id', scope.branchId)
  }

  const [routeResult, requestResult, driverResult] = await Promise.all([
    routeQuery.order('position', {ascending: true}),
    requestQuery.in('status', ['pending', 'open']),
    client.from('company_users')
      .select('company_id,branch_id,role,user_id')
      .eq('company_id', scope.companyId)
      .eq('role', 'driver'),
  ])

  const error = routeResult.error || requestResult.error || driverResult.error
  if (error) throw error

  return selectManagerDashboard(
    scope,
    (routeResult.data || []) as DashboardRoute[],
    (requestResult.data || []) as DashboardRequest[],
    (driverResult.data || []) as DashboardDriver[],
  )
}

/** Backward-compatible company/branch summary entry point. */
export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const membership = await currentMembership()
  const dashboard = await loadManagerDashboard({
    companyId: membership.company_id,
    branchId: membership.branch_id || null,
    routeDate: managerOperationalDate(),
  })
  return dashboard.summary
}
