import { useState, useCallback } from 'react'
import { supabase } from '../supabaseclient'

/**
 * useLikesV2 – Manage track likes with optimistic updates
 * @param {string} userId – Current user's ID (from session)
 * @returns {Object} { isLiked, toggleLike, loading, error, reset }
 */
export const useLikesV2 = (userId) => {
  const [likedTracks, setLikedTracks] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Fetch current user's liked track IDs
   */
  const fetchLikedTracks = useCallback(async (trackIds) => {
    if (!userId || !trackIds || trackIds.length === 0) {
      setLikedTracks(new Set())
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('track_likes')
        .select('track_id')
        .eq('user_id', userId)
        .in('track_id', trackIds)

      if (fetchError) throw fetchError

      const ids = new Set((data || []).map(row => row.track_id))
      setLikedTracks(ids)
    } catch (err) {
      console.error('Error fetching liked tracks:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  /**
   * Toggle like/unlike with optimistic update
   */
  const toggleLike = useCallback(async (trackId) => {
    if (!userId) {
      setError('Please sign in to like tracks')
      return false
    }

    if (!trackId) {
      setError('Invalid track ID')
      return false
    }

    const isCurrentlyLiked = likedTracks.has(trackId)

    // Optimistic update
    setLikedTracks(prev => {
      const updated = new Set(prev)
      if (isCurrentlyLiked) {
        updated.delete(trackId)
      } else {
        updated.add(trackId)
      }
      return updated
    })

    try {
      if (isCurrentlyLiked) {
        // Unlike
        const { error } = await supabase
          .from('track_likes')
          .delete()
          .match({ user_id: userId, track_id: trackId })

        if (error) throw error
      } else {
        // Like (idempotent: treat duplicate constraint as success)
        const { error } = await supabase
          .from('track_likes')
          .insert([{ user_id: userId, track_id: trackId }], { returning: 'minimal' })

        if (error) {
          // Check if it's a duplicate-key error (already liked)
          if (error.details && error.details.toString().includes('already exists')) {
            // Treat as success (already liked)
            return true
          }
          throw error
        }
      }

      setError(null)
      return true
    } catch (err) {
      console.error('Like/unlike error:', err)
      setError(err.message)

      // Revert optimistic update on error
      setLikedTracks(prev => {
        const updated = new Set(prev)
        if (isCurrentlyLiked) {
          updated.add(trackId)
        } else {
          updated.delete(trackId)
        }
        return updated
      })

      return false
    }
  }, [userId, likedTracks])

  /**
   * Check if a track is liked
   */
  const isLiked = useCallback((trackId) => {
    return likedTracks.has(trackId)
  }, [likedTracks])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setLikedTracks(new Set())
    setLoading(false)
    setError(null)
  }, [])

  return {
    isLiked,
    toggleLike,
    loading,
    error,
    fetchLikedTracks,
    reset
  }
}
