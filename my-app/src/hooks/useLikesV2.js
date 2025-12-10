import { useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../supabaseclient'
import { checkRateLimit } from '../utils/securityUtils'

const LIKE_RATE_LIMIT_MS = 2000 // 2 seconds between like/unlike actions

/**
 * useLikesV2 – Manage track likes with optimistic updates, debouncing, and rate limiting
 * @param {string} userId – Current user's ID (from session)
 * @returns {Object} { isLiked, toggleLike, loading, error, reset }
 */
export const useLikesV2 = (userId) => {
  const [likedTracks, setLikedTracks] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Track pending requests to prevent race conditions
  const pendingRequests = useRef(new Map())

  /**
   * Fetch current user's liked track IDs with caching
   */
  const fetchLikedTracks = useCallback(async (trackIds) => {
    if (!userId || !trackIds || trackIds.length === 0) {
      setLikedTracks(new Set())
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Deduplicate trackIds
      const uniqueIds = Array.from(new Set(trackIds))
      
      const { data, error: fetchError } = await supabase
        .from('track_likes')
        .select('track_id')
        .eq('user_id', userId)
        .in('track_id', uniqueIds)

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
   * Toggle like/unlike with optimistic update, debouncing, and rate limiting
   */
  const toggleLike = useCallback(async (trackId) => {
    if (!userId) {
      setError('Please sign in to like tracks')
      return false
    }

    if (!Number.isInteger(trackId) || trackId <= 0) {
      setError('Invalid track ID')
      return false
    }

    // Prevent duplicate requests for same track
    if (pendingRequests.current.has(trackId)) {
      return false
    }

    // Check rate limit per track
    const rateLimitKey = `like_${trackId}`
    const { canProceed, remainingMs } = checkRateLimit(rateLimitKey, LIKE_RATE_LIMIT_MS)
    
    if (!canProceed) {
      setError(`Please wait ${Math.ceil(remainingMs / 1000)}s before liking again`)
      return false
    }

    const isCurrentlyLiked = likedTracks.has(trackId)

    // Mark request as pending
    pendingRequests.current.set(trackId, true)

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
    } finally {
      // Remove from pending requests
      pendingRequests.current.delete(trackId)
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
    pendingRequests.current.clear()
  }, [])

  return useMemo(() => ({
    isLiked,
    toggleLike,
    loading,
    error,
    fetchLikedTracks,
    reset
  }), [isLiked, toggleLike, loading, error, fetchLikedTracks, reset])
}
