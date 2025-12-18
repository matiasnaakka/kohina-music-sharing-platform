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
            <div className="card-elevated p-4 sm:p-5 rounded-xl text-white flex flex-col gap-3 relative overflow-hidden">
              {/* Top row: cover on the left, title + avatar + album on the right */}
              <div className="flex gap-4 items-start">
                <div className="relative shrink-0">
                  <div
                    className="absolute inset-0 rounded-xl bg-linear-to-br from-teal-500/15 via-transparent to-amber-400/10 blur-lg"
                    aria-hidden="true"
                  />
                  <img
                    src={coverSrc}
                    alt={`${track.title} cover`}
                    className="relative w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl border border-gray-700 shadow-lg"
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

                <div className="flex-1 space-y-1.5">
                  {/* Desktop: title/avatar left, genre/public pills aligned to the right */
                  /* Mobile: pills move below with date/plays (see below) */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {profileAvatar && (
                        <img
                          src={profileAvatar}
                          alt="Profile avatar"
                          className="w-7 h-7 rounded-full object-cover border border-gray-600"
                          width="28"
                          height="28"
                          decoding="async"
                          loading="lazy"
                          onError={(e) => {
                            e.target.src = '/images/default-avatar.png'
                          }}
                        />
                      )}
                      <h4 className="font-semibold text-lg leading-tight tracking-wide text-white truncate">
                        {track.title}
                      </h4>
                    </div>

                    {/* Desktop-only pills on the top-right */}
                    <div className="hidden md:flex flex-wrap items-center gap-2 text-xs">
                      <span className="pill-subtle px-2 py-0.5 rounded-full">
                        {track.genres ? track.genres.name : 'No genre'}
                      </span>
                      {isOwn && (
                        <span className="pill-subtle px-2 py-0.5 rounded-full">
                          {track.is_public ? 'Public' : 'Private'}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-300 leading-relaxed text-sm">
                    {track.artist} {track.album ? `• ${track.album}` : ''}
                  </p>

                  {/* Mobile-only: pills + date + plays stacked under text */}
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs md:hidden">
                    <span className="pill-subtle px-2 py-0.5 rounded-full">
                      {track.genres ? track.genres.name : 'No genre'}
                    </span>
                    {isOwn && (
                      <span className="pill-subtle px-2 py-0.5 rounded-full">
                        {track.is_public ? 'Public' : 'Private'}
                      </span>
                    )}
                    <span className="text-gray-400">{formatDate(track.created_at)}</span>
                    <span className="text-gray-500">• 🎵 {track.play_count || 0} plays</span>
                  </div>

                  {/* Desktop-only: date + plays under artist/album, pills stay on the top-right */}
                  <div className="hidden md:flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-400">{formatDate(track.created_at)}</span>
                    <span className="text-gray-500">• 🎵 {track.play_count || 0} plays</span>
                  </div>
                </div>
              </div>

              {/* Bottom row: playback, like and add-to-playlist buttons */}
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
                    trackIsLiked ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-gray-700 text-white hover:bg-gray-600'
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
