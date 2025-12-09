import { supabase } from '../supabaseclient'

const EDGE_FN_URL = 'https://mpucvjyqvjxrnjgzpyjb.supabase.co/functions/v1/increase-playcount'

/**
 * Increment a track's play count via Edge Function
 * @param {number|string} trackId - The track ID to increment
 * @returns {Promise<number>} The new play count
 */
export async function incrementPlayCount(trackId) {
  if (!trackId) throw new Error('trackId required')
  
  const payload = { track_id: Number(trackId) }
  
  // Get the user's access token from the Supabase session
  let token = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token
  } catch (err) {
    console.warn('Could not retrieve session token:', err)
  }
  
  if (!token) {
    throw new Error('User session required to increment play count')
  }
  
  let res
  try {
    res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (networkErr) {
    console.error('Network error calling increase-playcount', networkErr)
    throw networkErr
  }
  
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  
  if (!res.ok) {
    const errMsg = (data && (data.error || data?.details)) || `Request failed: ${res.status}`
    const e = new Error(errMsg)
    e.details = data
    throw e
  }
  
  // Expecting { ok: true, new_play_count: ... }
  if (data && data.new_play_count !== undefined) return data.new_play_count
  
  // Fallback
  return data
}
