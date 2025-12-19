import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseclient'
import NavBar from '../components/NavBar'
import { useLikesV2 } from '../hooks/useLikesV2'
import { normalizeUuid } from '../utils/securityUtils'
import TrackCard from '../components/TrackCard'

export default function Playlist({ session, player }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const rawPlaylistId = searchParams.get('id')
  const playlistId = useMemo(() => normalizeUuid(rawPlaylistId) ?? (rawPlaylistId?.trim() || null), [rawPlaylistId])

  const [playlist, setPlaylist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [likeCounts, setLikeCounts] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [expandedComments, setExpandedComments] = useState(null)

  const { isLiked, toggleLike, fetchLikedTracks } = useLikesV2(session?.user?.id)

  const fetchPlaylist = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('id, title, description, owner, is_public, created_at, updated_at')
        .eq('id', playlistId)
        .single()

      if (playlistError) throw playlistError
      if (!playlistData) throw new Error('Playlist not found')

      const ownerCheck = session?.user?.id === playlistData.owner
      setIsOwner(ownerCheck)

      if (!playlistData.is_public && !ownerCheck) {
        throw new Error('This playlist is private')
      }

      setPlaylist(playlistData)

      const { data: tracksData, error: tracksError } = await supabase
        .from('playlist_tracks')
        .select(`
          id,
          track_id,
          created_at,
          tracks (
            id,
            title,
            artist,
            album,
            audio_path,
            image_path,
            user_id,
            created_at,
            play_count,
            genres(name),
            profiles!tracks_user_id_fkey(username, avatar_url)
          )
        `)
        .eq('playlist_id', playlistId)
        .order('created_at', { ascending: false })

      if (tracksError) throw tracksError

      const mappedTracks = (tracksData || [])
        .filter((pt) => pt.tracks)
        .map((pt) => ({
          ...pt.tracks,
          playlistTrackId: pt.id,
          addedAt: pt.created_at,
        }))

      setTracks(mappedTracks)

      // Fetch like counts for these tracks
      const ids = mappedTracks.map((t) => t.id).filter(Boolean)
      if (ids.length) {
        try {
          const { data: likesRows, error: likesErr } = await supabase
            .from('track_likes')
            .select('track_id')
            .in('track_id', ids)

          if (likesErr) throw likesErr

          const counts = new Map()
          for (const row of likesRows || []) {
            const tid = row.track_id
            counts.set(tid, (counts.get(tid) || 0) + 1)
          }
          setLikeCounts(counts)
        } catch (likesError) {
          console.warn('Failed to load like counts for playlist tracks:', likesError)
          setLikeCounts(new Map())
        }
      } else {
        setLikeCounts(new Map())
      }
    } catch (err) {
      console.error('Error fetching playlist:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [playlistId, session?.user?.id])

  useEffect(() => {
    if (!playlistId) {
      setError('Playlist ID not provided')
      setLoading(false)
      return
    }
    fetchPlaylist()
  }, [playlistId, session?.user?.id, fetchPlaylist])

  useEffect(() => {
    const trackIds = tracks.map((t) => t.id)
    if (trackIds.length > 0) {
      fetchLikedTracks(trackIds)
    }
  }, [tracks, fetchLikedTracks])

  const handleRemoveTrack = async (playlistTrackId) => {
    if (!isOwner) return
    setRemoving(playlistTrackId)
    try {
      const { error } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('id', playlistTrackId)

      if (error) throw error
      setTracks(tracks.filter((t) => t.playlistTrackId !== playlistTrackId))
    } catch (err) {
      setError(err.message)
    } finally {
      setRemoving(null)
    }
  }

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
      <div className="max-w-4xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{playlist?.title}</h1>
          {playlist?.description && <p className="text-gray-300 mb-2">{playlist.description}</p>}
          <p className="text-sm text-gray-400">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} • Created {formatDate(playlist?.created_at)} • Updated {formatDate(playlist?.updated_at)}
          </p>
          {!playlist?.is_public && <p className="text-xs text-gray-500 mt-1">🔒 Private Playlist</p>}
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
                      onClick={() => handleRemoveTrack(track.playlistTrackId)}
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
