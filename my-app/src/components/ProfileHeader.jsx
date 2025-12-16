export default function ProfileHeader({
  profile,
  isOwn,
  followerCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,
  onEditProfile,
  onFollowToggle,
  followLoading,
  isFollowing,
  followError,
}) {
  const avatar = profile?.avatar_url || '/default-avatar.png'
  const background = profile?.background_url
  const headerStyle = background
    ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.85)), url(${background})` }
    : {}

  return (
    <div
      className="flex flex-col md:flex-row items-start gap-4 mb-6 p-4 rounded-lg bg-gray-900/60 bg-cover bg-center min-h-[180px]"
      style={headerStyle}
    >
      <img
        src={avatar}
        alt={`${profile?.username || 'User'}'s avatar`}
        className="w-24 h-24 object-cover"
        width="96"
        height="96"
        decoding="async"
        loading="lazy"
        onError={(e) => {
          e.target.src = '/default-avatar.png'
        }}
      />
      <div className="flex-1">
        <h2 className="text-3xl font-bold mb-1">{profile?.username}</h2>
        {profile?.location && <p className="text-sm text-gray-300 mb-2">{profile.location}</p>}
        {profile?.bio && <p className="text-gray-200 whitespace-pre-line">{profile.bio}</p>}
      </div>
      <div className="flex flex-col items-start md:items-end gap-2 md:ml-auto">
        {isOwn ? (
          <button
            onClick={onEditProfile}
            className="px-4 py-2 rounded font-semibold bg-cyan-500 text-white hover:bg-cyan-700"
          >
            Profile settings
          </button>
        ) : (
          <button
            onClick={onFollowToggle}
            disabled={followLoading}
            className={`px-4 py-2 rounded-2xl font-semibold transition ${
              followLoading ? 'opacity-70 cursor-not-allowed' : ''
            } ${
              isFollowing ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-amber-500 text-white hover:bg-amber-300'
            }`}
          >
            {followLoading ? 'Processing...' : isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
        <span className="text-xl text-gray-400 space-x-2">
          <button
            type="button"
            onClick={onFollowersClick}
            className="hover:text-white underline-offset-2 hover:underline"
          >
            {followerCount === 1 ? '1 follower' : `${followerCount} followers`}
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={onFollowingClick}
            className="hover:text-white underline-offset-2 hover:underline"
          >
            Following {followingCount}
          </button>
        </span>
        {!isOwn && followError && <span className="text-2xl text-red-400">{followError}</span>}
      </div>
    </div>
  )
}
