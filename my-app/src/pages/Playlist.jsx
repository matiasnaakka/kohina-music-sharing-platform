import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase, getPublicStorageUrl } from '../supabaseclient'
import NavBar from '../components/NavBar'
import AddToPlaylist from '../components/AddToPlaylist'
import { useLikesV2 } from '../hooks/useLikesV2'

export default function Playlist({ session, player }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const playlistId = searchParams.get('id')
  const [playlist, setPlaylist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [removing, setRemoving] = useState(null)
  const { isLiked, toggleLike, fetchLikedTracks } = useLikesV2(session?.user?.id)

  useEffect(() => {
    if (!playlistId) {
      setError('Playlist ID not provided')
      setLoading(false)
      return
    }
    fetchPlaylist()
  }, [playlistId, session?.user?.id])

  useEffect(() => {
    const trackIds = tracks.map(t => t.id)
    if (trackIds.length > 0) {
      fetchLikedTracks(trackIds)
    }
  }, [tracks, fetchLikedTracks])

  const fetchPlaylist = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch playlist details
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('id, title, description, owner, is_public, created_at, updated_at')
        .eq('id', playlistId)
        .single()

      if (playlistError) throw playlistError
      if (!playlistData) throw new Error('Playlist not found')

      // Check if user is the owner
      const ownerCheck = session?.user?.id === playlistData.owner
      setIsOwner(ownerCheck)

      // Check if playlist is public or user is owner
      if (!playlistData.is_public && !ownerCheck) {
        throw new Error('This playlist is private')
      }

      setPlaylist(playlistData)

      // Fetch tracks in the playlist
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
            genres(name)
          )
        `)
        .eq('playlist_id', playlistId)
        .order('created_at', { ascending: false })

      if (tracksError) throw tracksError

      // Map tracks and filter out null entries
      const mappedTracks = (tracksData || [])
        .filter(pt => pt.tracks)
        .map(pt => ({
          ...pt.tracks,
          playlistTrackId: pt.id,
          addedAt: pt.created_at
        }))

      setTracks(mappedTracks)
    } catch (err) {
      console.error('Error fetching playlist:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTrack = async (playlistTrackId) => {
    if (!isOwner) return
    setRemoving(playlistTrackId)
    try {
      const { error } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('id', playlistTrackId)

      if (error) throw error
      setTracks(tracks.filter(t => t.playlistTrackId !== playlistTrackId))
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
      day: 'numeric'
    })
  }

  if (loading) return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={handleSignOut} />
      <div className="max-w-4xl mx-auto mt-16 p-6">Loading...</div>
    </div>
  )

  if (error) return (
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
        {/* Playlist header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{playlist?.title}</h1>
          {playlist?.description && (
            <p className="text-gray-300 mb-2">{playlist.description}</p>
          )}
          <p className="text-sm text-gray-400">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} • Created {formatDate(playlist?.created_at)} • Updated {formatDate(playlist?.updated_at)}
          </p>
          {!playlist?.is_public && (
            <p className="text-xs text-gray-500 mt-1">🔒 Private Playlist</p>
          )}
        </div>

        {/* Tracks list */}
        {tracks.length === 0 ? (
          <div className="bg-gray-800 p-4 rounded text-gray-300">
            This playlist is empty. {isOwner && 'Add tracks from the home page or user profiles.'}
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map(track => {
              const coverSrc =
                getPublicStorageUrl('track-images', track.image_path) ||
                track.profiles?.avatar_url ||
                '/default-avatar.png'
              const isActive = player?.currentTrack?.id === track.id
              const isBusy = isActive && player?.loading
              const canPlay = Boolean(track.audio_path)
              const playbackLabel = isActive
                ? isBusy
                  ? 'Loading...'
                  : player?.isPlaying
                    ? 'Pause'
                    : 'Resume'
                : 'Play'
              const handlePlayback = () => {
                if (!player || !canPlay) return
                if (isActive) {
                  player.isPlaying ? player.pause() : player.resume()
                } else {
                  player.playTrack(track)
                }
              }
              const trackIsLiked = isLiked(track.id)
              return (
                <div key={track.id} className="bg-gray-800 p-4 rounded flex gap-4 hover:bg-gray-750 transition">
                  <img
                    src={coverSrc}
                    alt={`${track.title} cover`}
                    className="w-20 h-20 object-cover rounded"
                    onError={(e) => { e.target.src = track.profiles?.avatar_url || '/default-avatar.png' }}
                  />
                  <div className="flex flex-col md:flex-row justify-between flex-1 gap-2">
                    <div>
                      <h3 className="font-bold text-lg">{track.title}</h3>
                      <p className="text-gray-300">{track.artist} {track.album ? `• ${track.album}` : ''}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {track.genres ? track.genres.name : 'No genre'} • Added {formatDate(track.addedAt)} • 🎵 {track.play_count || 0} plays
                      </p>
                    </div>
                    <div className="flex items-center gap-2 md:justify-end flex-wrap">
                      {canPlay ? (
                        <>
                          <button
                            type="button"
                            onClick={handlePlayback}
                            disabled={isBusy}
                            className="bg-teal-500 text-black px-3 py-1 rounded text-sm font-semibold hover:bg-teal-400 disabled:opacity-60 whitespace-nowrap"
                          >
                            {playbackLabel}
                          </button>
                          {isActive && player?.error && !player.loading && (
                            <span className="max-w-[140px] truncate text-xs text-red-400">
                              {player.error}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-400 text-sm">Audio unavailable</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleLike(track.id)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition ${
                          trackIsLiked
                            ? 'bg-red-500 text-white hover:bg-red-400'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {trackIsLiked ? '❤️' : '🤍'}
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTrack(track.playlistTrackId)}
                          disabled={removing === track.playlistTrackId}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
