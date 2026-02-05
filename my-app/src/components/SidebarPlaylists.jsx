import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseclient'

export default function SidebarPlaylists({ title = 'Public playlists', playlists, loading, error, isOwner = false, onRename }) {
  const [localPlaylists, setLocalPlaylists] = useState(playlists || [])
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState(null)

  // Keep local copy in sync when prop changes
  useEffect(() => {
    setLocalPlaylists(playlists || [])
  }, [playlists])
  return (
    <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
      <h4 className="text-xl font-semibold mb-3">{title}</h4>
      {loading ? (
        <div className="text-gray-400 text-sm">Loading playlists...</div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : !playlists || playlists.length === 0 ? (
        <div className="text-gray-400 text-sm">No public playlists yet.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {(localPlaylists || []).map((playlist) => (
            <li key={playlist.id}>
              <div className="block bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {editingId === playlist.id ? (
                      <div className="flex gap-2">
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full bg-gray-900 px-2 py-1 rounded text-sm text-white"
                          aria-label="Edit playlist title"
                        />
                        <button
                          onClick={async () => {
                            if (!editValue || editValue.trim() === '') return
                            setRenameLoading(true)
                            setRenameError(null)
                            try {
                              const { error } = await supabase
                                .from('playlists')
                                .update({ title: editValue.trim() })
                                .eq('id', playlist.id)
                              if (error) throw error
                              const updated = { ...playlist, title: editValue.trim() }
                              setLocalPlaylists((prev) => prev.map(p => (p.id === playlist.id ? updated : p)))
                              setEditingId(null)
                              setEditValue('')
                              if (onRename) onRename(playlist.id, updated.title)
                            } catch (err) {
                              setRenameError(err.message || 'Failed to rename')
                            } finally {
                              setRenameLoading(false)
                            }
                          }}
                          disabled={renameLoading}
                          className="px-2 py-1 bg-amber-500 text-black rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditValue('')
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <Link to={`/playlist?id=${playlist.id}`} className="text-white font-semibold truncate block">
                          {playlist.title}
                        </Link>
                        {playlist.description && (
                          <p className="text-gray-400 text-xs mt-1 line-clamp-2">{playlist.description}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          Updated {new Date(playlist.updated_at).toLocaleDateString()}
                        </p>
                      </>
                    )}
                  </div>

                  {isOwner && editingId !== playlist.id && (
                    <div className="shrink-0 ml-2">
                      <button
                        onClick={() => {
                          setEditingId(playlist.id)
                          setEditValue(playlist.title || '')
                          setRenameError(null)
                        }}
                        className="px-2 py-1 bg-gray-700 text-white rounded text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                {renameError && <div className="text-red-400 text-xs mt-2">{renameError}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
