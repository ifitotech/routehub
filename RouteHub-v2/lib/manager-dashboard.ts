export type ManagerDashboardScope = {
  companyId: string
  branchId: string | null
  routeDate: string
}

export type DashboardRoute = {
  id: string
  company_id: string
  branch_id: string | null
  route_date: string | null
  mission_type?: string | null
  destination_name?: string | null
  status: string
  driver_id?: string | null
  position?: number | null
}

export type DashboardRequest = {
  company_id: string
  branch_id: string | null
  status: string
}

export type DashboardDriver = {
  company_id: string
  branch_id: string | null
  role: string
  user_id: string
}

export type DashboardSummary = {
  activeRoutes: number
  pendingRoutes: number
  completedRoutes: number
  openIssues: number
  pendingRequests?: number
  availableDrivers?: number
}

export type ManagerDashboardData = {
  summary: DashboardSummary
  todayRoutes: DashboardRoute[]
}

const visibleTodayStatuses = new Set(['pending', 'published', 'active', 'paused', 'completed', 'issue'])

function matchesBranch(recordBranchId: string | null, scopeBranchId: string | null) {
  return scopeBranchId === null || recordBranchId === scopeBranchId
}

export function routeMatchesManagerToday(route: DashboardRoute, scope: ManagerDashboardScope) {
  return route.company_id === scope.companyId
    && matchesBranch(route.branch_id, scope.branchId)
    && route.route_date === scope.routeDate
}

/**
 * Pure selector used by both the UI loader and focused scope tests. A
 * temporary Team Member's route is included naturally because routes are
 * scoped by company/branch/date, not by permanent role.
 */
export function selectManagerDashboard(
  scope: ManagerDashboardScope,
  routes: DashboardRoute[],
  requests: DashboardRequest[],
  drivers: DashboardDriver[],
): ManagerDashboardData {
  const scopedRoutes = routes.filter(route => routeMatchesManagerToday(route, scope))
  const todayRoutes = scopedRoutes
    .filter(route => visibleTodayStatuses.has(route.status))
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0) || left.id.localeCompare(right.id))

  const pendingRequests = requests.filter(request => request.company_id === scope.companyId
    && matchesBranch(request.branch_id, scope.branchId)
    && ['pending', 'open'].includes(request.status)).length
  const availableDrivers = new Set(drivers.filter(driver => driver.company_id === scope.companyId
    && driver.role === 'driver'
    && (scope.branchId === null || driver.branch_id === null || driver.branch_id === scope.branchId))
    .map(driver => driver.user_id)).size

  return {
    todayRoutes,
    summary: {
      // Preserve the existing product meaning while fixing its scope.
      activeRoutes: scopedRoutes.filter(route => ['published', 'active', 'paused'].includes(route.status)).length,
      pendingRoutes: scopedRoutes.filter(route => route.status === 'pending').length,
      completedRoutes: scopedRoutes.filter(route => route.status === 'completed').length,
      pendingRequests,
      availableDrivers,
      // RouteHub records execution problems on routes, so this reflects
      // today's branch issues rather than stale company-wide route_stops.
      openIssues: scopedRoutes.filter(route => route.status === 'issue').length,
    },
  }
}
