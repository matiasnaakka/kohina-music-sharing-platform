import { useState, useCallback, useEffect } from 'react'
import { postComment, fetchComments, deleteComment, updateComment } from '../utils/commentUtils'

/**
 * Hook to manage track comments
 * @param {number} trackId - The track ID
 * @returns {Object} Comments state and methods
 */
export function useComments(trackId) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [posting, setPosting] = useState(false)

  // Fetch comments when trackId changes
  const loadComments = useCallback(async () => {
    if (!trackId) return

    setLoading(true)
    setError(null)
    try {
      const data = await fetchComments(trackId)
      setComments(data)
    } catch (err) {
      console.error('Load comments error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [trackId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Post a comment
  const addComment = useCallback(async (body) => {
    if (!trackId || !body?.trim()) {
      setError('Comment cannot be empty')
      return false
    }

    setPosting(true)
    setError(null)
    try {
      const newComment = await postComment(trackId, body)
      setComments(prev => [newComment, ...prev])
      return true
    } catch (err) {
      console.error('Add comment error:', err)
      setError(err.message)
      return false
    } finally {
      setPosting(false)
    }
  }, [trackId])

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

  return {
    comments,
    loading,
    error,
    posting,
    addComment,
    removeComment,
    editComment,
    loadComments
  }
}
