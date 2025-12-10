import { useState } from 'react'
import { useComments } from '../hooks/useComments'
import { validateCommentText } from '../utils/securityUtils'

const TrackComments = ({ trackId, session }) => {
  const { comments, loading, error, posting, addComment, removeComment, editComment } = useComments(trackId)
  const [commentText, setCommentText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [validationError, setValidationError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError(null)

    if (!session?.user?.id) {
      setValidationError('Please sign in to comment')
      return
    }

    // Validate input
    const validation = validateCommentText(commentText)
    if (!validation.isValid) {
      setValidationError(validation.error)
      return
    }

    const success = await addComment(validation.text)
    if (success) {
      setCommentText('')
    }
  }

  const handleEditSubmit = async (commentId) => {
    setValidationError(null)

    // Validate input
    const validation = validateCommentText(editingText)
    if (!validation.isValid) {
      setValidationError(validation.error)
      return
    }

    const success = await editComment(commentId, validation.text)
    if (success) {
      setEditingId(null)
      setEditingText('')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="mt-6 border-t border-gray-700 pt-6">
      <h3 className="text-xl font-bold mb-4">Comments ({comments.length})</h3>

      {(error || validationError) && (
        <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded mb-4">
          {error || validationError}
        </div>
      )}

      {/* Comment form */}
      {session?.user?.id ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Share your thoughts about this track... (max 5000 characters)"
            maxLength={5000}
            className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {commentText.length} / 5000
            </span>
            <button
              type="submit"
              disabled={posting || !commentText.trim()}
              className="bg-teal-500 text-black px-4 py-2 rounded font-semibold hover:bg-teal-400 disabled:opacity-60"
            >
              {posting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-800 p-4 rounded mb-6 text-gray-300">
          <p>Sign in to comment on this track</p>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="text-gray-400">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-gray-400">No comments yet. Be the first to comment!</div>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="bg-gray-800 bg-opacity-50 p-4 rounded">
              <div className="flex gap-3">
                <img
                  src={comment.profiles?.avatar_url || '/default-avatar.png'}
                  alt={comment.profiles?.username || 'User'}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                  onError={(e) => { e.target.src = '/default-avatar.png' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">
                        {comment.profiles?.username || 'Anonymous'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(comment.created_at)}
                        {comment.updated_at && comment.updated_at !== comment.created_at && (
                          <span> (edited)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {editingId === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        maxLength={5000}
                        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                        rows={2}
                      />
                      <div className="text-xs text-gray-500 mt-1 mb-2">
                        {editingText.length} / 5000
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSubmit(comment.id)}
                          className="bg-teal-500 text-black px-3 py-1 rounded text-sm font-semibold hover:bg-teal-400"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditingText('')
                            setValidationError(null)
                          }}
                          className="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-200 mt-2 break-words whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  )}

                  {/* Edit/Delete buttons */}
                  {session?.user?.id === comment.user_id && editingId !== comment.id && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditingText(comment.body)
                          setValidationError(null)
                        }}
                        className="text-xs text-teal-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this comment?')) {
                            removeComment(comment.id)
                          }
                        }}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrackComments
