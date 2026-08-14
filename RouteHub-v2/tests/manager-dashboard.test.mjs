import test from 'node:test'
import assert from 'node:assert/strict'
import {operationalDate} from '../lib/driver-queue.ts'
import {selectManagerDashboard} from '../lib/manager-dashboard.ts'

const scope = {companyId:'company-a',branchId:'miami',routeDate:'2026-08-13'}
const route = (id, branchId, routeDate, status = 'published', driverId = 'driver-a', companyId = 'company-a', position = 1) => ({
  id,
  company_id:companyId,
  branch_id:branchId,
  route_date:routeDate,
  status,
  driver_id:driverId,
  position,
})

test('Manager Today includes only the current company, branch and route_date', () => {
  const result = selectManagerDashboard(scope, [
    route('miami-today-1','miami','2026-08-13','active'),
    route('miami-today-2','miami','2026-08-13','published', 'driver-a', 'company-a', 2),
    route('miami-today-3','miami','2026-08-13','completed', 'driver-a', 'company-a', 3),
    route('miami-tomorrow-1','miami','2026-08-14'),
    route('miami-tomorrow-2','miami','2026-08-14'),
    route('fort-lauderdale-1','fort-lauderdale','2026-08-13'),
    route('other-company','miami','2026-08-13','published','driver-x','company-b'),
  ], [], [])

  assert.deepEqual(result.todayRoutes.map(item => item.id), [
    'miami-today-1',
    'miami-today-2',
    'miami-today-3',
  ])
  assert.equal(result.summary.activeRoutes, 2)
})

test('temporary Team assignments count as route activity without changing Driver membership', () => {
  const drivers = [
    {company_id:'company-a',branch_id:'miami',role:'driver',user_id:'driver-a'},
    {company_id:'company-a',branch_id:'miami',role:'sales_representative',user_id:'sales-a'},
  ]
  const result = selectManagerDashboard(scope, [
    route('primary-delivery','miami','2026-08-13','active','driver-a'),
    route('temporary-pickup','miami','2026-08-13','published','sales-a', 'company-a', 1),
  ], [], drivers)

  assert.equal(result.todayRoutes.length, 2)
  assert.equal(result.summary.activeRoutes, 2)
  assert.equal(result.summary.availableDrivers, 1)
})

test('branch metrics preserve their business scope', () => {
  const requests = [
    {company_id:'company-a',branch_id:'miami',status:'pending'},
    {company_id:'company-a',branch_id:'fort-lauderdale',status:'pending'},
    {company_id:'company-a',branch_id:'miami',status:'assigned'},
  ]
  const drivers = [
    {company_id:'company-a',branch_id:'miami',role:'driver',user_id:'miami-driver'},
    {company_id:'company-a',branch_id:null,role:'driver',user_id:'company-driver'},
    {company_id:'company-a',branch_id:'fort-lauderdale',role:'driver',user_id:'north-driver'},
  ]
  const result = selectManagerDashboard(scope, [
    route('today-issue','miami','2026-08-13','issue'),
    route('old-issue','miami','2026-08-12','issue'),
  ], requests, drivers)

  assert.deepEqual(result.todayRoutes.map(item => item.id), ['today-issue'])
  assert.equal(result.summary.pendingRequests, 1)
  assert.equal(result.summary.openIssues, 1)
  assert.equal(result.summary.availableDrivers, 2)
})

test('no routes today produces a clean empty Today collection', () => {
  const result = selectManagerDashboard(scope, [route('tomorrow','miami','2026-08-14')], [], [])
  assert.deepEqual(result.todayRoutes, [])
  assert.equal(result.summary.activeRoutes, 0)
  assert.equal(result.summary.openIssues, 0)
})

test('operational date uses the local calendar and avoids a UTC date shift', () => {
  const localLateEvening = new Date(2026, 7, 13, 23, 55)
  assert.equal(operationalDate(localLateEvening), '2026-08-13')
})
