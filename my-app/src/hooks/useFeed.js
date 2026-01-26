import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseclient'

// useFeed: minimal hook to support the home feed modes
// - mode === 'all' -> does nothing (home's existing fetchTracks remains responsible)
// - mode === 'following' -> fetches tracks uploaded by users the session user follows
export default function useFeed(session, mode = 'all') {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchFollowing = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!session?.user?.id) {
        setTracks([])
        return
      }

      // Get list of followed user ids
      const { data: follows, error: followsErr } = await supabase
        .from('followers')
        .select('followed_id')
        .eq('follower_id', session.user.id)

      if (followsErr) throw followsErr

      const ids = (follows || []).map((f) => f.followed_id).filter(Boolean)
      if (ids.length === 0) {
        // No followed users: return empty feed without running an empty IN query
        setTracks([])
        return
      }

      // Fetch tracks from followed users - mirror the shape the Home feed expects
      const { data: tracksData, error: tracksErr } = await supabase
        .from('tracks')
        .select(`
          *,
          profiles!tracks_user_id_fkey(username, avatar_url),
          genres(name)
        `)
        .in('user_id', ids)
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (tracksErr) throw tracksErr
      setTracks(tracksData || [])
    } catch (err) {
      setError(err)
      setTracks([])
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (mode === 'following') {
      fetchFollowing()
    }
  }, [mode, fetchFollowing])

  return { tracks, loading, error, refresh: fetchFollowing }
}
