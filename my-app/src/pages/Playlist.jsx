import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseclient'
import NavBar from '../components/NavBar'
import { useLikesV2 } from '../hooks/useLikesV2'
import { normalizeUuid } from '../utils/securityUtils'
import TrackCard from '../components/TrackCard'
import usePlaylist from '../hooks/usePlaylist'

export default function Playlist({ session, player }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const rawPlaylistId = searchParams.get('id')
  const playlistId = useMemo(() => normalizeUuid(rawPlaylistId) ?? (rawPlaylistId?.trim() || null), [rawPlaylistId])

  const [expandedComments, setExpandedComments] = useState(null)

  const { isLiked, toggleLike, fetchLikedTracks } = useLikesV2(session?.user?.id)

  const {
    playlist,
    tracks,
    likeCounts,
    loading,
    error,
    isOwner,
    removing,
    deleting,
    removeTrack,
    deletePlaylist,
  } = usePlaylist(playlistId, session?.user?.id)

  useEffect(() => {
    const trackIds = tracks.map((t) => t.id)
    if (trackIds.length > 0) {
      fetchLikedTracks(trackIds)
    }
  }, [tracks, fetchLikedTracks])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleDeleteClick = async () => {
    if (!isOwner) return
    const ok = window.confirm('Are you sure you want to permanently delete this playlist?')
    if (!ok) return
    try {
      await deletePlaylist()
      navigate('/home')
    } catch (err) {
      console.error(err)
    }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-black text-white">
        <NavBar session={session} onSignOut={handleSignOut} />
        <div className="max-w-4xl mx-auto mt-16 p-6">Loading...</div>
      </div>
    )

  if (error)
    return (
      <div className="min-h-screen bg-black text-white">
        <NavBar session={session} onSignOut={handleSignOut} />
        <div className="max-w-4xl mx-auto mt-16 p-6">
          <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{error}</div>
          <button onClick={() => navigate('/home')} className="mt-4 bg-teal-500 text-black px-4 py-2 rounded">
            Back to Home
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={handleSignOut} />
      <div className="max-w-4xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg pb-40">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{playlist?.title}</h1>
          {playlist?.description && <p className="text-gray-300 mb-2">{playlist.description}</p>}
          <p className="text-sm text-gray-400">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} • Created {formatDate(playlist?.created_at)} • Updated {formatDate(playlist?.updated_at)}
          </p>
          {!playlist?.is_public && <p className="text-xs text-gray-500 mt-1">🔒 Private Playlist</p>}
          {isOwner && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleting}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-500 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete playlist'}
              </button>
            </div>
          )}
        </div>

        {tracks.length === 0 ? (
          <div className="bg-gray-800 p-4 rounded text-gray-300">
            This playlist is empty. {isOwner && 'Add tracks from the home page or user profiles.'}
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track, idx) => (
              <div key={track.id} className="space-y-2">
                <TrackCard
                  track={{ ...track, created_at: track.addedAt || track.created_at }}
                  trackList={tracks}
                  idx={idx}
                  profileAvatar={track.profiles?.avatar_url}
                  player={player}
                  session={session}
                  isOwn={isOwner}
                  expandedComments={expandedComments}
                  onToggleComments={(id) => setExpandedComments(id === expandedComments ? null : id)}
                  isTrackLiked={isLiked}
                  onToggleLike={toggleLike}
                  likeCounts={likeCounts}
                />
                {isOwner && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeTrack(track.playlistTrackId)}
                      disabled={removing === track.playlistTrackId}
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-500 disabled:opacity-60"
                    >
                      Remove from playlist
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
