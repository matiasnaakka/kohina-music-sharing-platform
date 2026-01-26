import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseclient'
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
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token
  } catch (err) {
    console.error('[incrementPlayCount] Error retrieving session:', err)
  }
  
  // Allow anonymous playcount increments by falling back to the anon key
  const authToken = token || SUPABASE_ANON_KEY
  if (!authToken) {
    console.error('[incrementPlayCount] Error: No access token or anon key available')
    throw new Error('Edge function credentials not available')
  }
  
  const payload = { track_id: Number(id) }
  // payload and EDGE_FN_URL are used in the request below
  
  let res
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    })
    // response received
  } catch (networkErr) {
    console.error('[incrementPlayCount] Network error:', networkErr)
    throw networkErr
  }
  
  const text = await res.text()
  
  let data
  try {
    data = JSON.parse(text)
  } catch {
    // Could not parse JSON, will use raw text
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
    return data.new_play_count
  }

  // Fallback: return whatever the function returned
  return data
}
