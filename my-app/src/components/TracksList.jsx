import { Suspense, lazy } from 'react'
import { getPublicStorageUrl } from '../supabaseclient'

const AddToPlaylist = lazy(() => import('./AddToPlaylist'))
const TrackComments = lazy(() => import('./TrackComments'))

export default function TracksList({
  tracks,
  loading,
  error,
  profileAvatar,
  player,
  session,
  isOwn,
  formatDate,
  expandedComments,
  onToggleComments,
  isTrackLiked,
  onToggleLike,
  emptyMessage,
}) {
  if (loading) return <div>Loading tracks...</div>
  if (error) return <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{error}</div>
  if (!tracks || tracks.length === 0)
    return <div className="text-gray-300 bg-gray-800 p-4 rounded">{emptyMessage}</div>

  return (
    <div className="grid grid-cols-1 gap-4">
      {tracks.map((track, idx) => {
        const coverSrc =
          getPublicStorageUrl('track-images', track.image_path) || profileAvatar || '/default-avatar.png'
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
          <div key={track.id}>
            <div className="bg-gray-800 bg-opacity-80 p-4 rounded text-white flex gap-4">
              <img
                src={coverSrc}
                alt={`${track.title} cover`}
                className="w-24 h-24 object-cover rounded"
                width="96"
                height="96"
                decoding="async"
                fetchpriority={idx === 0 ? 'high' : undefined}
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  e.target.src = profileAvatar || '/default-avatar.png'
                }}
              />
              <div className="flex flex-col md:flex-row justify-between flex-1">
                <div>
                  <h4 className="font-bold text-lg">{track.title}</h4>
                  <p className="text-gray-300">
                    {track.artist} {track.album ? `• ${track.album}` : ''}
                  </p>
                  <div className="flex gap-2 items-center mt-1 flex-wrap">
                    <span className="bg-gray-700 px-2 py-0.5 text-xs rounded">
                      {track.genres ? track.genres.name : 'No genre'}
                    </span>
                    {isOwn && (
                      <span className="bg-gray-700 px-2 py-0.5 text-xs rounded">
                        {track.is_public ? 'Public' : 'Private'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(track.created_at)}</span>
                    <span className="text-xs text-gray-500">• 🎵 {track.play_count || 0} plays</span>
                  </div>
                </div>
                <div className="shrink-0 min-w-[200px] flex items-center gap-2 mt-3 md:mt-0 flex-wrap">
                  {canPlay ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePlayback}
                        disabled={isBusy}
                        className="bg-teal-500 text-black px-3 py-1 rounded text-sm font-semibold hover:bg-teal-400 disabled:opacity-60"
                      >
                        {playbackLabel}
                      </button>
                      {isActive && player?.error && !player.loading && (
                        <span className="max-w-[140px] truncate text-xs text-red-400">{player.error}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-red-400">Audio unavailable</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleLike(track.id)}
                    className={`px-2 py-1 rounded text-sm font-semibold transition ${
                      trackIsLiked ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {trackIsLiked ? '❤️ Liked' : '🤍 Like'}
                  </button>
                  <Suspense fallback={null}>
                    <AddToPlaylist session={session} track={track} />
                  </Suspense>
                </div>
              </div>
            </div>

            {expandedComments === track.id && (
              <div className="bg-gray-900 p-4 rounded-b mt-0 border-t border-gray-700">
                <Suspense fallback={<div className="text-gray-400 text-sm">Loading comments…</div>}>
                  <TrackComments trackId={track.id} session={session} />
                </Suspense>
              </div>
            )}

            <button
              type="button"
              onClick={() => onToggleComments(expandedComments === track.id ? null : track.id)}
              className="text-xs text-blue-400 hover:underline mt-2 block"
            >
              {expandedComments === track.id ? 'Hide comments' : 'View comments'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
