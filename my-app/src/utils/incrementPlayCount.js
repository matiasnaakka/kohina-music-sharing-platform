import { supabase, SUPABASE_URL } from '../supabaseclient'
import { validateId } from './securityUtils'

// Derive from configured Supabase project URL to avoid environment mismatches.
const EDGE_FN_URL = (() => {
  try {
    if (!SUPABASE_URL) return null
    return new URL('/functions/v1/increase-playcount', new URL(SUPABASE_URL).origin).toString()
  } catch {
    return null
  }
})()

/**
 * Increment a track's play count via Edge Function
 * @param {number|string} trackId - The track ID to increment
 * @returns {Promise<number>} The new play count
 */
export async function incrementPlayCount(trackId) {
  const id = typeof trackId === 'string' ? Number(trackId) : trackId
  if (!validateId(id)) {
    throw new Error('Invalid trackId')
  }
  if (!EDGE_FN_URL) {
    throw new Error('Edge function URL not configured')
  }

  // Get the user's access token from the Supabase session
  let token = null
  try {
    console.log('[incrementPlayCount] Fetching session...')
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token
    console.log('[incrementPlayCount] Session retrieved. Token available:', !!token)
  } catch (err) {
    console.error('[incrementPlayCount] Error retrieving session:', err)
  }
  
  if (!token) {
    console.error('[incrementPlayCount] Error: No access token found')
    throw new Error('User session required to increment play count')
  }
  
  const payload = { track_id: Number(id) }
  console.log('[incrementPlayCount] Payload:', payload)
  console.log('[incrementPlayCount] Edge Function URL:', EDGE_FN_URL)
  
  let res
  try {
    console.log('[incrementPlayCount] Making POST request...')
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    console.log('[incrementPlayCount] Response received. Status:', res.status)
  } catch (networkErr) {
    console.error('[incrementPlayCount] Network error:', networkErr)
    throw networkErr
  }
  
  const text = await res.text()
  console.log('[incrementPlayCount] Response text:', text)
  
  let data
  try {
    data = JSON.parse(text)
    console.log('[incrementPlayCount] Parsed JSON:', data)
  } catch {
    console.log('[incrementPlayCount] Could not parse as JSON, using raw text')
    data = text
  }
  
  if (!res.ok) {
    const errMsg = (data && (data.error || data?.details)) || `Request failed: ${res.status}`
    console.error('[incrementPlayCount] Error response:', errMsg)
    const e = new Error(errMsg)
    e.details = data
    throw e
  }
  
  // Expecting { ok: true, new_play_count: ... }
  if (data && data.new_play_count !== undefined) {
    console.log(`✅ Play count incremented for track ${trackId}. New count: ${data.new_play_count}`)
    return data.new_play_count
  }
  
  // Fallback
  console.log(`✅ Play count incremented for track ${trackId}.`, data)
  return data
}
