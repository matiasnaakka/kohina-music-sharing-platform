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
    <div className="grid grid-cols-1 gap-5">
      {tracks.map((track, idx) => {
        const coverSrc =
          getPublicStorageUrl('track-images', track.image_path) || profileAvatar || '/images/default-avatar.png'
        const isActive = player?.currentTrack?.id === track.id
        const isBusy = isActive && player?.loading
        const canPlay = Boolean(track.audio_path)
        const playbackLabel = isActive ? (isBusy ? 'Loading...' : player?.isPlaying ? 'Pause' : 'Resume') : 'Play'
        const handlePlayback = () => {
          if (!player || !canPlay) return
          if (isActive) {
            player.isPlaying ? player.pause() : player.resume()
          } else {
            player.playTrack(track, tracks)
          }
        }
        const trackIsLiked = isTrackLiked(track.id)

        return (
          <div key={track.id}>
            <div className="card-elevated p-5 rounded-xl text-white flex gap-5 relative overflow-hidden">
              <div className="relative shrink-0">
                <div
                  className="absolute inset-0 rounded-xl bg-linear-to-br from-teal-500/15 via-transparent to-amber-400/10 blur-lg"
                  aria-hidden="true"
                />
                <img
                  src={coverSrc}
                  alt={`${track.title} cover`}
                  className="relative w-28 h-28 object-cover rounded-xl border border-gray-700 shadow-lg"
                  width="112"
                  height="112"
                  decoding="async"
                  fetchpriority={idx === 0 ? 'high' : undefined}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  onError={(e) => {
                    e.target.src = profileAvatar || '/images/default-avatar.png'
                  }}
                />
              </div>
              <div className="flex flex-col md:flex-row justify-between flex-1 gap-3">
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg leading-tight tracking-wide text-white">{track.title}</h4>
                  <p className="text-gray-300 leading-relaxed">
                    {track.artist} {track.album ? `• ${track.album}` : ''}
                  </p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="pill-subtle px-2 py-0.5 text-xs rounded-full">
                      {track.genres ? track.genres.name : 'No genre'}
                    </span>
                    {isOwn && (
                      <span className="pill-subtle px-2 py-0.5 text-xs rounded-full">
                        {track.is_public ? 'Public' : 'Private'}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(track.created_at)}</span>
                    <span className="text-xs text-gray-500">• 🎵 {track.play_count || 0} plays</span>
                  </div>
                </div>
                <div className="shrink-0 min-w-[220px] flex items-center gap-2 mt-1 md:mt-0 flex-wrap">
                  {canPlay ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePlayback}
                        disabled={isBusy}
                        className="btn-accent px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {playbackLabel}
                      </button>
                      {isActive && player?.error && !player.loading && (
                        <span className="max-w-40 truncate text-xs text-red-400">{player.error}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-red-400">Audio unavailable</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleLike(track.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                      trackIsLiked
                        ? 'bg-red-500 text-white hover:bg-red-400'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {trackIsLiked ? '❤️ Liked' : '🤍 Like'}
                  </button>
                  <Suspense fallback={null}>
                    <AddToPlaylist
                      session={session}
                      track={track}
                      buttonClassName="bg-gray-700 text-white px-2.5 py-1.5 rounded-lg text-sm hover:bg-gray-600"
                    />
                  </Suspense>
                </div>
              </div>
            </div>

            {expandedComments === track.id && (
              <div className="card-subtle p-4 rounded-b-xl mt-0 border-t border-gray-800">
                <Suspense fallback={<div className="text-gray-400 text-sm">Loading comments…</div>}>
                  <TrackComments trackId={track.id} session={session} />
                </Suspense>
              </div>
            )}

            <button
              type="button"
              onClick={() => onToggleComments(expandedComments === track.id ? null : track.id)}
              className="text-xs text-teal-300 hover:underline mt-3 block"
            >
              {expandedComments === track.id ? 'Hide comments' : 'View comments'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
