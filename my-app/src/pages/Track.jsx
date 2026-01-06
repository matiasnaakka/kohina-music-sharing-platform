import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import TracksList from '../components/TracksList'
import { supabase, getPublicStorageUrl } from '../supabaseclient'

// Lightweight single-track page for shared links
export default function Track({ session, player }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const trackIdParam = searchParams.get('id')

  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedComments, setExpandedComments] = useState(null)
  const [likeCounts, setLikeCounts] = useState(new Map())
  const [likeLoading, setLikeLoading] = useState(false)

  const fetchTrack = useCallback(async () => {
    if (!trackIdParam) {
      setError('No track id provided.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: trackError } = await supabase
        .from('tracks')
        .select(`
          id, user_id, title, artist, album, audio_path, created_at, image_path, play_count,
          is_public,
          genres(name),
          profiles!tracks_user_id_fkey(username, avatar_url)
        `)
        .eq('id', trackIdParam)
        .is('deleted_at', null)
        .single()

      if (trackError) throw trackError
      if (!data) throw new Error('Track not found.')

      // If not public and not owner, block
      const isOwner = session?.user?.id && data.user_id === session.user.id
      if (!data.is_public && !isOwner) {
        throw new Error('This track is private.')
      }

      setTrack(data)
    } catch (err) {
      setTrack(null)
      setError(err.message || 'Failed to load track.')
    } finally {
      setLoading(false)
    }
  }, [trackIdParam, session?.user?.id])

  useEffect(() => {
    fetchTrack()
  }, [fetchTrack])

  // Load like count for the single track
  useEffect(() => {
    const loadLikes = async () => {
      const numericId = trackIdParam ? Number(trackIdParam) : null
      if (!numericId) {
        setLikeCounts(new Map())
        return
      }
      setLikeLoading(true)
      try {
        const { data, error } = await supabase
          .from('track_likes')
          .select('track_id')
          .eq('track_id', numericId)

        if (error) throw error
        const counts = new Map()
        for (const row of data || []) {
          const tid = Number(row.track_id)
          counts.set(tid, (counts.get(tid) || 0) + 1)
        }
        // Ensure the key exists even if zero rows
        if (!counts.has(numericId)) counts.set(numericId, 0)
        setLikeCounts(counts)
      } catch (err) {
        console.warn('Failed to load like counts for track page', err)
        setLikeCounts(new Map())
      } finally {
        setLikeLoading(false)
      }
    }

    loadLikes()
  }, [trackIdParam])

  const handlePlay = useCallback(() => {
    if (!track || !player) return
    player.playTrack(track, [track])
  }, [track, player])

  const cover = track?.image_path ? getPublicStorageUrl('track-images', track.image_path) : null
  const canPlay = Boolean(track?.audio_path)

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={() => supabase.auth.signOut()} />
      <div className="max-w-4xl mx-auto mt-16 p-6 pb-24">
        {loading ? (
          <div>Loading track…</div>
        ) : error ? (
          <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4">{error}</div>
        ) : !track ? (
          <div className="text-gray-300">Track not found.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <img
                src={cover || '/images/default-avatar.png'}
                alt={`${track.title} cover`}
                className="w-28 h-28 object-cover rounded-xl border border-gray-800"
                width="112"
                height="112"
                decoding="async"
                loading="lazy"
                onError={(e) => {
                  e.target.src = '/images/default-avatar.png'
                }}
              />
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{track.title}</h1>
                <p className="text-gray-300 text-sm">{track.artist}{track.album ? ` • ${track.album}` : ''}</p>
                <p className="text-gray-400 text-sm mt-2">Uploaded by {track.profiles?.username || 'Unknown'}</p>
                <div className="mt-3 flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={handlePlay}
                    disabled={!canPlay || player?.loading}
                    className="btn-accent px-4 py-2 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {player?.isPlaying && player?.currentTrack?.id === track.id ? 'Pause/Resume in player' : 'Play in player'}
                  </button>
                  {!track.is_public && <span className="text-xs text-amber-300">Private (you can see this because you own it)</span>}
                </div>
              </div>
            </div>

            <TracksList
              tracks={[track]}
              loading={false}
              error={null}
              profileAvatar={track.profiles?.avatar_url}
              player={player}
              session={session}
              isOwn={session?.user?.id === track.user_id}
              expandedComments={expandedComments}
              onToggleComments={(id) => setExpandedComments(expandedComments === id ? null : id)}
              isTrackLiked={() => false}
              onToggleLike={() => {}}
              likeCounts={likeCounts}
              isAuthenticated={!!session?.user?.id}
              emptyMessage=""
            />
          </div>
        )}
      </div>
    </div>
  )
}
