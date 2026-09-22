import {createClient} from '@supabase/supabase-js'
import {NextRequest, NextResponse} from 'next/server'

type Bucket = {count: number; resetAt: number}

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

/**
 * Maps and geocoding endpoints spend paid provider quota. Require the same
 * signed-in RouteHub session used by the UI before passing a request upstream.
 * The in-memory limit is a second layer of protection; provider-side key
 * restrictions and Supabase authentication remain the primary controls.
 */
export async function requireQuotaUser(request: NextRequest, endpoint: string, limit = 60): Promise<{userId: string} | {response: NextResponse}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!url || !anonKey || !token) return {response: NextResponse.json({error: 'Authentication required.'}, {status: 401})}

  const client = createClient(url, anonKey, {auth: {persistSession: false, autoRefreshToken: false}})
  const {data, error} = await client.auth.getUser(token)
  if (error || !data.user) return {response: NextResponse.json({error: 'Authentication required.'}, {status: 401})}

  const now = Date.now()
  const key = `${endpoint}:${data.user.id}`
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {count: 1, resetAt: now + WINDOW_MS})
    return {userId: data.user.id}
  }
  if (bucket.count >= limit) {
    return {response: NextResponse.json({error: 'Too many requests. Try again shortly.'}, {status: 429, headers: {'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000))}})}
  }
  bucket.count += 1
  return {userId: data.user.id}
}
