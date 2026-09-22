'use client'

import {getSupabase} from './supabase'

/** Attach the active RouteHub access token to server routes that use paid APIs. */
export async function authenticatedApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const {data} = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Authentication required.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, {...init, headers})
}
