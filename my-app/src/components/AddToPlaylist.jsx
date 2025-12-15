// AddToPlaylist.jsx
// - Modal UI to let the logged-in user add a track to an existing playlist or create a new playlist.
// - Uses playlist_tracks to create the relation and avoids duplicates.

import { useState, useEffect } from 'react'
import { supabase } from '../supabaseclient'

const AddToPlaylist = ({ session, track, buttonClassName = 'bg-gray-700 text-white px-2 py-1 rounded text-sm hover:bg-gray-600' }) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [playlists, setPlaylists] = useState([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)
  const [newPlaylist, setNewPlaylist] = useState({ title: '', description: '', is_public: true })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open || !session?.user?.id) return
    const loadPlaylists = async () => {
      // Load user's playlists when modal opens
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('playlists')
        .select('id, title, is_public')
        .eq('owner', session.user.id)
        .order('created_at', { ascending: true })
      if (fetchError) setError(fetchError.message)
      setPlaylists(data || [])
      setLoading(false)
    }
    loadPlaylists()
  }, [open, session?.user?.id])

  /**
   * addTrackToPlaylist
   * - Ensures the track isn't already present in the playlist
   * - Appends it to the end (computes next position)
   */
  const addTrackToPlaylist = async (playlistId) => {
    if (!playlistId) return
    setError(null)
    setFeedback(null)
    setLoading(true)
    try {
      const { data: existingRows, error: existingError } = await supabase
        .from('playlist_tracks')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('track_id', track.id)
        .limit(1)
      if (existingError) throw existingError
      if (existingRows?.length) {
        setFeedback('Track is already in this playlist.')
        setLoading(false)
        return
      }
      const { data: lastRow, error: lastError } = await supabase
        .from('playlist_tracks')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
      if (lastError) throw lastError
      const nextPosition = lastRow?.[0]?.position ? lastRow[0].position + 1 : 1
      const { error: insertError } = await supabase.from('playlist_tracks').insert({
        playlist_id: playlistId,
        track_id: track.id,
        position: nextPosition,
        added_by: session.user.id
      })
      if (insertError) throw insertError
      setFeedback('Added to playlist.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * handleCreatePlaylist
   * - Creates a new playlist and immediately adds the track to it
   */
  const handleCreatePlaylist = async (e) => {
    e.preventDefault()
    if (!newPlaylist.title.trim()) {
      setError('Playlist title is required.')
      return
    }
    setError(null)
    setFeedback(null)
    setCreating(true)
    try {
      const { data, error: playlistError } = await supabase
        .from('playlists')
        .insert({
          owner: session.user.id,
          title: newPlaylist.title.trim(),
          description: newPlaylist.description.trim() || null,
          is_public: newPlaylist.is_public
        })
        .select('id, title, is_public')
        .single()
      if (playlistError) throw playlistError
      setPlaylists((prev) => [...prev, data])
      setSelectedPlaylistId(data.id)
      setNewPlaylist({ title: '', description: '', is_public: true })
      await addTrackToPlaylist(data.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  if (!session?.user?.id || !track?.id) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        Add to playlist
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add “{track.title}”</h3>
              <button
                type="button"
                className="text-gray-300 hover:text-white text-xl"
                onClick={() => {
                  setOpen(false)
                  setSelectedPlaylistId(null)
                  setFeedback(null)
                  setError(null)
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}
            {feedback && <div className="text-sm text-emerald-400">{feedback}</div>}

            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-200">Your playlists</h4>
              {loading ? (
                <div className="text-sm text-gray-400">Loading playlists...</div>
              ) : playlists.length === 0 ? (
                <div className="text-sm text-gray-400">No playlists yet. Create one below.</div>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {playlists.map((playlist) => (
                    <li key={playlist.id} className="flex items-center justify-between gap-2 bg-gray-800 px-3 py-2 rounded">
                      <div>
                        <p className="text-sm text-white">{playlist.title}</p>
                        <p className="text-xs text-gray-400">{playlist.is_public ? 'Public' : 'Private'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addTrackToPlaylist(playlist.id)}
                        className="text-xs bg-teal-500 text-black px-2 py-1 rounded hover:bg-teal-400"
                        disabled={loading}
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2 border-t border-gray-800 pt-4">
              <h4 className="text-sm font-semibold text-gray-200">Create new playlist</h4>
              <form onSubmit={handleCreatePlaylist} className="space-y-2 text-sm text-white">
                <input
                  type="text"
                  placeholder="Title *"
                  value={newPlaylist.title}
                  onChange={(e) => setNewPlaylist((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded bg-gray-800 px-3 py-2 text-white"
                  required
                  disabled={creating}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newPlaylist.description}
                  onChange={(e) => setNewPlaylist((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded bg-gray-800 px-3 py-2 text-white"
                  rows={2}
                  disabled={creating}
                />
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={newPlaylist.is_public}
                    onChange={(e) => setNewPlaylist((prev) => ({ ...prev, is_public: e.target.checked }))}
                    disabled={creating}
                  />
                  Make playlist public
                </label>
                <button
                  type="submit"
                  className="w-full bg-indigo-500 text-black px-3 py-2 rounded font-semibold hover:bg-indigo-400 disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create & add track'}
                </button>
              </form>
            </section>
          </div>
        </div>
      )}
    </>
  )
}

export default AddToPlaylist
