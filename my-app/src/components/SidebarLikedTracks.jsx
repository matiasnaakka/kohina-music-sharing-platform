import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { getPublicStorageUrl } from '../supabaseclient'

const AddToPlaylist = lazy(() => import('./AddToPlaylist'))

export default function SidebarLikedTracks({
  tracks,
  loading,
  error,
  player,
  session,
  isTrackLiked,
  onToggleLike,
  title = 'Liked Tracks',
}) {
  if (loading) return <aside className="bg-gray-900 bg-opacity-80 p-4 rounded"><div className="text-gray-400 text-sm">Loading...</div></aside>
  if (error) return <aside className="bg-gray-900 bg-opacity-80 p-4 rounded"><div className="text-red-400 text-sm">{error}</div></aside>
  if (!tracks || tracks.length === 0)
    return (
      <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
        <h4 className="text-xl font-semibold mb-3">{title}</h4>
        <div className="text-gray-400 text-sm">No liked tracks yet.</div>
      </aside>
    )

  return (
    <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
      <h4 className="text-xl font-semibold mb-3">{title}</h4>
      <div className="max-h-96 overflow-y-auto space-y-2">
        {tracks.map((track) => {
          const coverSrc =
            getPublicStorageUrl('track-images', track.image_path) ||
            track.profiles?.avatar_url ||
            '/images/default-avatar.png'
          const isActive = player?.currentTrack?.id === track.id
          const isBusy = isActive && player?.loading
          const canPlay = Boolean(track.audio_path)
          const playbackLabel = isActive ? (isBusy ? 'Loading...' : player?.isPlaying ? 'Pause' : 'Resume') : 'Play'
          const handlePlayback = () => {
            if (!player || !canPlay) return
            if (isActive) {
              player.isPlaying ? player.pause() : player.resume()
            } else {
              player.playTrack(track)
            }
          }
          const trackIsLiked = isTrackLiked(track.id)

          return (
            <div key={track.id} className="bg-gray-800 bg-opacity-60 p-2 rounded hover:bg-opacity-80 transition text-xs">
              <div className="flex gap-2 mb-1">
                <img
                  src={coverSrc}
                  alt={`${track.title} cover`}
                  className="w-12 h-12 object-cover rounded shrink-0"
                  width="48"
                  height="48"
                  decoding="async"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = track.profiles?.avatar_url || '/images/default-avatar.png'
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h5 className="font-semibold truncate">{track.title}</h5>
                  <p className="text-gray-400 truncate">{track.artist}</p>
                  <Link
                    to={`/profile?user=${track.user_id}`}
                    className="text-gray-500 hover:text-teal-300 truncate text-xs underline"
                  >
                    {track.profiles?.username || 'Anonymous'}
                  </Link>
                  <p className="text-gray-500 text-xs mt-1">🎵 {track.play_count || 0} plays</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {canPlay ? (
                  <button
                    type="button"
                    onClick={handlePlayback}
                    disabled={isBusy}
                    className="bg-amber-300 text-black px-1.5 py-0.5 rounded text-xs font-semibold hover:bg-teal-400 disabled:opacity-60"
                  >
                    {playbackLabel}
                  </button>
                ) : (
                  <span className="text-red-400 text-xs">No audio</span>
                )}
                <button
                  type="button"
                  onClick={() => onToggleLike(track.id)}
                  className={`px-1 py-0.5 rounded text-xs transition ${
                    trackIsLiked ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {trackIsLiked ? '❤️' : '🤍'}
                </button>
                <Suspense fallback={null}>
                  <AddToPlaylist
                    session={session}
                    track={track}
                    buttonClassName="bg-gray-700 text-white px-1.5 py-0.5 rounded text-xs hover:bg-gray-600"
                  />
                </Suspense>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
