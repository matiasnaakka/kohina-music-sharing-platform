import { supabase } from '../supabaseclient'

/**
 * Post a comment on a track
 * @param {number} trackId - The track ID
 * @param {string} body - The comment text
 * @returns {Promise<Object>} The created comment
 */
export async function postComment(trackId, body) {
  if (!trackId || !body?.trim()) {
    throw new Error('Track ID and comment text are required')
  }

  const user = (await supabase.auth.getUser())?.data?.user
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('track_comments')
    .insert({
      track_id: trackId,
      user_id: user.id,
      body: body.trim()
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
  if (!trackId) {
    throw new Error('Track ID is required')
  }

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
    .eq('track_id', trackId)
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
 * Delete a comment (hard delete)
 * @param {number} commentId - The comment ID
 * @returns {Promise<Object>} Success response
 */
export async function deleteComment(commentId) {
  if (!commentId) {
    throw new Error('Comment ID is required')
  }

  const { error } = await supabase
    .from('track_comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Delete comment error:', error)
    throw error
  }

  return { success: true }
}

/**
 * Update a comment
 * @param {number} commentId - The comment ID
 * @param {string} newBody - The new comment text
 * @returns {Promise<Object>} The updated comment
 */
export async function updateComment(commentId, newBody) {
  if (!commentId || !newBody?.trim()) {
    throw new Error('Comment ID and text are required')
  }

  const { data, error } = await supabase
    .from('track_comments')
    .update({
      body: newBody.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', commentId)
    .select()
    .single()

  if (error) {
    console.error('Update comment error:', error)
    throw error
  }

  return data
}
