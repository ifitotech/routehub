import fs from 'node:fs'

const env = {}
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Supabase environment is not configured.')
  process.exit(1)
}

const projectUrl = url.replace(/\/+$/, '')
const headers = {apikey: key, Authorization: `Bearer ${key}`}
const requiredTables = [
  'routes',
  'company_users',
  'branches',
  'users',
  'driving_sessions',
  'support_requests',
  'app_error_reports',
  'push_subscriptions',
  'native_push_tokens',
  'trucks',
  'truck_fuel_logs',
  'truck_maintenance_logs',
]
const requiredRouteColumns = [
  'arrived_at',
  'finalized_at',
  'destination_lat',
  'destination_lng',
  'destination_contact_name',
]

const authHealth = await fetch(`${projectUrl}/auth/v1/health`, {headers})
if (!authHealth.ok) {
  console.error(`Supabase Auth health check failed with HTTP ${authHealth.status}.`)
  process.exitCode = 1
} else {
  console.log('Supabase Auth is reachable.')
}

const checks = await Promise.all(requiredTables.map(async table => {
  const response = await fetch(`${projectUrl}/rest/v1/${table}?select=*&limit=0`, {headers})
  return {table, ok: response.ok, status: response.status}
}))
const missingTables = checks.filter(check => !check.ok)
const columnChecks = await Promise.all(requiredRouteColumns.map(async column => {
  const response = await fetch(`${projectUrl}/rest/v1/routes?select=${encodeURIComponent(column)}&limit=0`, {headers})
  return {column, ok: response.ok, status: response.status}
}))
const missingRouteColumns = columnChecks.filter(check => !check.ok)

if (missingTables.length || missingRouteColumns.length) {
  console.error(`Pilot schema checks failed: ${missingTables.map(check => `${check.table} (HTTP ${check.status})`).join(', ')}`)
  if (missingRouteColumns.length) console.error(`Route columns unavailable: ${missingRouteColumns.map(check => `${check.column} (HTTP ${check.status})`).join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`Supabase REST accepts read-only schema probes for ${requiredTables.length} pilot-critical tables and all required route workflow columns.`)
}
