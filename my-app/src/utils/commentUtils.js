import { supabase } from '../supabaseclient'
import { validateId, validateCommentText } from './securityUtils'

/**
 * Post a comment on a track
 * @param {number} trackId - The track ID
 * @param {string} body - The comment text
 * @returns {Promise<Object>} The created comment
 */
export async function postComment(trackId, body) {
  const tid = typeof trackId === 'string' ? Number(trackId) : trackId
  if (!validateId(tid)) throw new Error('Invalid track ID')

  const validation = validateCommentText(body)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  const user = (await supabase.auth.getUser())?.data?.user
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('track_comments')
    .insert({
      track_id: Number(tid),
      user_id: user.id,
      body: validation.text
    })
    .select()
    .single()

  if (error) {
    console.error('Post comment error:', error)
    throw error
  }

  return data
}

/**
 * Fetch comments for a track
 * @param {number} trackId - The track ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Array>} Array of comments with user info
 */
export async function fetchComments(trackId, { from = 0, to = 49 } = {}) {
  const tid = typeof trackId === 'string' ? Number(trackId) : trackId
  if (!validateId(tid)) throw new Error('Invalid track ID')

  const { data, error } = await supabase
    .from('track_comments')
    .select(`
      id,
      track_id,
      user_id,
      body,
      created_at,
      updated_at,
      profiles!track_comments_user_id_fkey(id, username, avatar_url)
    `)
    .eq('track_id', Number(tid))
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Fetch comments error:', error)
    throw error
  }

  return data || []
}

/**
 * Delete a comment (hard delete) - with authorization check
 * @param {number} commentId - The comment ID
 * @returns {Promise<Object>} Success response
 */
export async function deleteComment(commentId) {
  const cid = typeof commentId === 'string' ? Number(commentId) : commentId
  if (!validateId(cid)) throw new Error('Invalid comment ID')

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Fetch comment to verify ownership
  const { data: comment, error: fetchError } = await supabase
    .from('track_comments')
    .select('id, user_id')
    .eq('id', Number(cid))
    .single()

  if (fetchError || !comment) {
    throw new Error('Comment not found')
  }

  // Verify ownership (client-side check; RLS enforces on backend)
  if (comment.user_id !== user.id) {
    throw new Error('Unauthorized: You can only delete your own comments')
  }

  const { error } = await supabase
    .from('track_comments')
    .delete()
    .eq('id', Number(cid))
    .eq('user_id', user.id) // Double-check via RLS

  if (error) {
    console.error('Delete comment error:', error)
    throw error
  }

  return { success: true }
}

/**
 * Update a comment - with authorization check
 * @param {number} commentId - The comment ID
 * @param {string} newBody - The new comment text
 * @returns {Promise<Object>} The updated comment
 */
export async function updateComment(commentId, newBody) {
  const cid = typeof commentId === 'string' ? Number(commentId) : commentId
  if (!validateId(cid)) throw new Error('Invalid comment ID')

  const validation = validateCommentText(newBody)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Fetch comment to verify ownership
  const { data: comment, error: fetchError } = await supabase
    .from('track_comments')
    .select('id, user_id')
    .eq('id', Number(cid))
    .single()

  if (fetchError || !comment) {
    throw new Error('Comment not found')
  }

  // Verify ownership
  if (comment.user_id !== user.id) {
    throw new Error('Unauthorized: You can only edit your own comments')
  }

  const { data, error } = await supabase
    .from('track_comments')
    .update({
      body: validation.text,
      updated_at: new Date().toISOString()
    })
    .eq('id', Number(cid))
    .eq('user_id', user.id) // Double-check via RLS
    .select()
    .single()

  if (error) {
    console.error('Update comment error:', error)
    throw error
  }

  return data
}
