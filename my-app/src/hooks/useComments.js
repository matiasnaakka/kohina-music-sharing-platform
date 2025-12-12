import { useState, useCallback, useEffect, useMemo } from 'react'
import { postComment, fetchComments, deleteComment, updateComment } from '../utils/commentUtils'
import { checkRateLimit } from '../utils/securityUtils'

const COMMENT_RATE_LIMIT_MS = 5000 // 5 seconds between comments

/**
 * Hook to manage track comments with optimizations and rate limiting
 * @param {number} trackId - The track ID
 * @returns {Object} Comments state and methods
 */
export function useComments(trackId) {
  const tid = typeof trackId === 'string' ? Number(trackId) : trackId

  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [posting, setPosting] = useState(false)

  // Memoize fetch to prevent unnecessary calls
  const loadComments = useCallback(async () => {
    if (!tid) return

    setLoading(true)
    setError(null)
    try {
      const data = await fetchComments(tid)
      setComments(data)
    } catch (err) {
      console.error('Load comments error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tid])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Post a comment with rate limiting
  const addComment = useCallback(async (body) => {
    if (!tid || !body?.trim()) {
      setError('Comment cannot be empty')
      return false
    }

    // Check rate limit
    const rateLimitKey = `comment_${tid}`
    const { canProceed, remainingMs } = checkRateLimit(rateLimitKey, COMMENT_RATE_LIMIT_MS)
    
    if (!canProceed) {
      setError(`Please wait ${Math.ceil(remainingMs / 1000)} seconds before posting another comment`)
      return false
    }

    setPosting(true)
    setError(null)
    try {
      const newComment = await postComment(tid, body)
      setComments(prev => [newComment, ...prev])
      return true
    } catch (err) {
      console.error('Add comment error:', err)
      setError(err.message)
      return false
    } finally {
      setPosting(false)
    }
  }, [tid])

  // Delete a comment
  const removeComment = useCallback(async (commentId) => {
    setError(null)
    try {
      await deleteComment(commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
      return true
    } catch (err) {
      console.error('Remove comment error:', err)
      setError(err.message)
      return false
    }
  }, [])

  // Update a comment
  const editComment = useCallback(async (commentId, newBody) => {
    if (!newBody?.trim()) {
      setError('Comment cannot be empty')
      return false
    }

    setError(null)
    try {
      const updated = await updateComment(commentId, newBody)
      setComments(prev =>
        prev.map(c => (c.id === commentId ? updated : c))
      )
      return true
    } catch (err) {
      console.error('Edit comment error:', err)
      setError(err.message)
      return false
    }
  }, [])

  // Memoize return object to prevent unnecessary dependency updates
  return useMemo(() => ({
    comments,
    loading,
    error,
    posting,
    addComment,
    removeComment,
    editComment,
    loadComments
  }), [comments, loading, error, posting, addComment, removeComment, editComment, loadComments])
}
