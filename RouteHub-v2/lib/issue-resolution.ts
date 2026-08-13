import {recordActivity} from './activity'
import {currentMembership, currentUser} from './data'
import {getCurrentLocation} from './location'
import {buildCompletionPatch} from './mission-payload'
import {uploadMissionEvidence} from './mission-evidence'
import {getSupabase} from './supabase'

type ResolveIssueInput = { routeId: string; note: string; photo?: File | null; complete?: boolean }

/** Adds evidence to a driver's own issue and optionally closes it as completed. */
export async function resolveDriverIssue({routeId, note, photo, complete = false}: ResolveIssueInput) {
  const [user, membership] = await Promise.all([currentUser(), currentMembership()])
  const client = getSupabase()
  if (photo) await uploadMissionEvidence(photo, routeId)

  let location: {lat: number; lng: number; accuracy: number} | undefined
  if (complete) {
    try { location = await getCurrentLocation() } catch { /* Manual completion is valid when GPS is unavailable. */ }
  }

  const patch = {
    ...(note.trim() ? {notes: note.trim()} : {}),
    ...(complete ? buildCompletionPatch(location) : {}),
    updated_version: Date.now(),
  }
  const {data, error} = await client.from('routes').update(patch)
    .eq('id', routeId).eq('driver_id', user.id).eq('company_id', membership.company_id).select().single()
  if (error) throw error

  await recordActivity({
    companyId: membership.company_id,
    userId: user.id,
    action: complete ? 'delivery_completed' : 'delivery_issue_updated',
    recordId: routeId,
    after: {hasPhoto: Boolean(photo), note: note.trim() || null, resolved: complete, location: location || null},
  })
  return data
}
