import TrackCard from './TrackCard'

export default function TracksList({
  tracks,
  loading,
  error,
  profileAvatar,
  player,
  session,
  isOwn,
  expandedComments,
  onToggleComments,
  isTrackLiked,
  onToggleLike,
  emptyMessage,
  likeCounts, // optional: Map or object of trackId -> likes
}) {
  if (loading) return <div>Loading tracks...</div>
  if (error) return <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{error}</div>
  if (!tracks || tracks.length === 0)
    return <div className="text-gray-300 bg-gray-800 p-4 rounded">{emptyMessage}</div>

  return (
    <div className="grid grid-cols-1 gap-5">
      {tracks.map((track, idx) => {
        return (
          <div key={track.id}>
            <TrackCard
              track={track}
              idx={idx}
              trackList={tracks}
              profileAvatar={profileAvatar}
              player={player}
              session={session}
              isOwn={isOwn}
              expandedComments={expandedComments}
              onToggleComments={onToggleComments}
              isTrackLiked={isTrackLiked}
              onToggleLike={onToggleLike}
              likeCounts={likeCounts}
            />
          </div>
        )
      })}
    </div>
  )
}
