/** Creates a non-reversible token value for legacy invitation schemas. */
export async function createInvitationTokenHash(): Promise<string> {
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}-${Math.random()}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
