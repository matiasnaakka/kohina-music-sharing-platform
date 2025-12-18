import { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase, getPublicStorageUrl } from '../supabaseclient'
import NavBar from '../components/NavBar'
const AddToPlaylist = lazy(() => import('../components/AddToPlaylist'))
const TrackComments = lazy(() => import('../components/TrackComments'))
import { useLikesV2 } from '../hooks/useLikesV2'

export default function Home({ session, player }) {
  const [tracks, setTracks] = useState([])
  const [filteredTracks, setFilteredTracks] = useState([])
  const [genres, setGenres] = useState([])
  const [selectedGenreIds, setSelectedGenreIds] = useState([]) // was selectedGenreId
  const [showGenres, setShowGenres] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [displayName, setDisplayName] = useState('user')
  const [ownPlaylists, setOwnPlaylists] = useState([])
  const [ownPlaylistsLoading, setOwnPlaylistsLoading] = useState(false)
  const [ownPlaylistsError, setOwnPlaylistsError] = useState(null)
  const { isLiked, toggleLike, loading: likesLoading, fetchLikedTracks } = useLikesV2(session?.user?.id)
  const [expandedComments, setExpandedComments] = useState(null)

  // NEW: sort controls
  const [sortField, setSortField] = useState('recent') // 'recent' | 'plays' | 'likes'
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' | 'asc'
  const [likeCounts, setLikeCounts] = useState(new Map())
  const [likeCountsLoading, setLikeCountsLoading] = useState(false)

  // Fetch tracks and genres on component mount
  useEffect(() => {
    fetchGenres()
    fetchTracks()
    if (session?.user?.id) {
      fetchOwnPlaylists(session.user.id)
    }
  }, [session?.user?.id])

  // Fetch display name (username) of the logged-in user
  useEffect(() => {
    const loadName = async () => {
      try {
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single()
          if (!error && data?.username) {
            setDisplayName(data.username)
          } else {
            setDisplayName(session?.user?.email ?? 'user')
          }
        } else {
          setDisplayName('user')
        }
      } catch {
        setDisplayName(session?.user?.email ?? 'user')
      }
    }
    loadName()
  }, [session?.user?.id])

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      setGenres(data || [])
    } catch (err) {
      console.error('Error fetching genres:', err)
      setError('Failed to load genres')
    }
  }

  const fetchTracks = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select(`
          *,
          profiles!tracks_user_id_fkey(username, avatar_url),
          genres(name)
        `)
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setTracks(data || [])
      setFilteredTracks(data || [])

      // NEW: fetch like counts for these tracks (for sorting by likes)
      const ids = (data || []).map(t => t.id).filter(Boolean)
      setLikeCountsLoading(true)
      try {
        if (ids.length === 0) {
          setLikeCounts(new Map())
        } else {
          const { data: likesRows, error: likesErr } = await supabase
            .from('track_likes')
            .select('track_id')
            .in('track_id', ids)

          if (likesErr) throw likesErr

          const counts = new Map()
          for (const row of (likesRows || [])) {
            const tid = row.track_id
            counts.set(tid, (counts.get(tid) || 0) + 1)
          }
          setLikeCounts(counts)
        }
      } catch (e) {
        console.warn('Failed to load like counts:', e)
        setLikeCounts(new Map())
      } finally {
        setLikeCountsLoading(false)
      }
    } catch (err) {
      console.error('Error fetching tracks:', err)
      setError('Failed to load tracks')
    } finally {
      setLoading(false)
    }
  }

  const fetchOwnPlaylists = async (userId) => {
    setOwnPlaylistsLoading(true)
    setOwnPlaylistsError(null)
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, title, description, is_public, updated_at')
        .eq('owner', userId)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setOwnPlaylists(data || [])
    } catch (err) {
      setOwnPlaylists([])
      setOwnPlaylistsError(err.message)
    } finally {
      setOwnPlaylistsLoading(false)
    }
  }

  // Filter tracks when genre selection changes (now supports multi-select)
  useEffect(() => {
    if (selectedGenreIds.length > 0) {
      setFilteredTracks(tracks.filter(track => selectedGenreIds.includes(track.genre_id)))
    } else {
      setFilteredTracks(tracks)
    }
  }, [selectedGenreIds, tracks])

  const handleGenreToggle = (genreId) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    )
  }

  const handleClearGenres = () => {
    setSelectedGenreIds([])
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

  // Fetch liked tracks when tracks load
  useEffect(() => {
    const trackIds = tracks.map(t => t.id)
    if (trackIds.length > 0) {
      fetchLikedTracks(trackIds)
    }
  }, [tracks, fetchLikedTracks])

  // NEW: apply sorting after filtering
  const displayedTracks = useMemo(() => {
    const arr = [...(filteredTracks || [])]
    const dir = sortOrder === 'asc' ? 1 : -1

    const getLikes = (t) => likeCounts.get(t.id) || 0
    const getPlays = (t) => Number(t.play_count || 0)
    const getCreated = (t) => new Date(t.created_at || 0).getTime()

    arr.sort((a, b) => {
      if (sortField === 'likes') return (getLikes(a) - getLikes(b)) * dir
      if (sortField === 'plays') return (getPlays(a) - getPlays(b)) * dir
      // recent
      return (getCreated(a) - getCreated(b)) * dir
    })

    return arr
  }, [filteredTracks, likeCounts, sortField, sortOrder])

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={handleSignOut} />
      <div className="max-w-5xl mx-auto mt-16 p-6 pb-32 md:pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-white">Nice to see you, {displayName}!</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-white">Your playlists</h2>
          {ownPlaylistsLoading ? (
            <div className="text-sm text-gray-400 bg-gray-800 px-3 py-2 rounded">Loading playlists...</div>
          ) : ownPlaylistsError ? (
            <div className="text-sm text-red-400 bg-red-500/20 px-3 py-2 rounded">{ownPlaylistsError}</div>
          ) : ownPlaylists.length === 0 ? (
            <div className="text-sm text-gray-400 bg-gray-800 px-3 py-2 rounded">Create a playlist to see it here.</div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {ownPlaylists.map((playlist) => (
                <li key={playlist.id}>
                  <Link
                    to={`/playlist?id=${playlist.id}`}
                    className="block bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition"
                  >
                    <p className="text-white font-semibold truncate">{playlist.title}</p>
                    {playlist.description && (
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1">{playlist.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {playlist.is_public ? 'Public' : 'Private'} • Updated{' '}
                      {new Date(playlist.updated_at).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3 text-white">Filter by Genre</h2>
          <div
            className="relative inline-block"
            onMouseEnter={() => setShowGenres(true)}
            onMouseLeave={() => setShowGenres(false)}
          >
            <button
              type="button"
              className="px-3 py-1 rounded text-sm bg-gray-700 text-white hover:bg-gray-600"
            >
              Filter{selectedGenreIds.length > 0 ? ` (${selectedGenreIds.length})` : ''}
            </button>

            {showGenres && (
              <div className="absolute z-20 mt-2 w-64 rounded bg-gray-900 border border-gray-700 shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                  <span className="text-sm text-gray-300">Select genres</span>
                  <button
                    type="button"
                    onClick={handleClearGenres}
                    className="text-xs text-teal-300 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <ul
                  className="max-h-56 overflow-y-auto divide-y divide-gray-800"
                  role="listbox"
                  aria-label="Genres"
                >
                  {genres.map((genre) => {
                    const selected = selectedGenreIds.includes(genre.id)
                    return (
                      <li
                        key={genre.id}
                        role="option"
                        aria-selected={selected}
                        onClick={() => handleGenreToggle(genre.id)}
                        className={`cursor-pointer px-3 py-2 flex items-center justify-between ${
                          selected ? 'bg-teal-500/20 text-teal-300' : 'hover:bg-gray-800'
                        }`}
                        title={genre.description}
                      >
                        <span>{genre.name}</span>
                        {selected && <span className="text-teal-300">✓</span>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1 text-white">Recent Tracks</h2>
            {sortField === 'likes' && (
              <div className="text-xs text-gray-400">
                {likeCountsLoading ? 'Loading like counts…' : 'Sorted by like count'}
              </div>
            )}
          </div>

          {/* NEW: Sort controls */}
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-300">
              Sort by{' '}
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="ml-2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              >
                <option value="recent">Recent</option>
                <option value="plays">Listening count</option>
                <option value="likes">Likes</option>
              </select>
            </label>

            <label className="text-sm text-gray-300">
              Order{' '}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="ml-2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
              >
                <option value="desc">Top</option>
                <option value="asc">Bottom</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded mb-4">
            {error}
            <button 
              onClick={fetchTracks}
              className="ml-4 bg-red-700 px-2 py-1 rounded text-white"
            >
              Retry
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="text-white">Loading tracks...</div>
        ) : displayedTracks.length === 0 ? (
          <div className="text-white bg-gray-800 p-6 rounded">
            {selectedGenreIds.length > 0
              ? "No tracks found for the selected genres. Try selecting different genres."
              : "No tracks available yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {displayedTracks.map((track, idx) => {
              const coverSrc =
                getPublicStorageUrl('track-images', track.image_path) ||
                track.profiles?.avatar_url ||
                '/images/default-avatar.png'
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
                  player.playTrack(track, displayedTracks)
                }
              }
              const trackIsLiked = isLiked(track.id)
              const handleLikeClick = async () => {
                await toggleLike(track.id)
              }
              return (
                <div key={track.id}>
                  <div className="bg-gray-800 bg-opacity-80 p-4 rounded shadow-lg text-white flex gap-4">
                    <img
                      src={coverSrc}
                      alt={`${track.title} cover`}
                      className="w-24 h-24 object-cover rounded"
                      width="96"
                      height="96"
                      decoding="async"
                      // Prioritize first cover for LCP
                      fetchpriority={idx === 0 ? 'high' : undefined}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      onError={(e) => { e.target.src = track.profiles?.avatar_url || '/images/default-avatar.png' }}
                    />
                    <div className="flex flex-col md:flex-row justify-between flex-1">
                      <div className="mb-3 md:mb-0">
                        <div className="flex items-center gap-3 mb-1">
                          {track.profiles?.avatar_url && (
                            <Link
                              to={`/profile?user=${encodeURIComponent(track.user_id)}`}
                              className="inline-block"
                              aria-label={`View ${track.profiles?.username || 'user'}'s profile`}
                            >
                              <img 
                                src={track.profiles.avatar_url} 
                                alt="User avatar"
                                className="w-8 h-8 rounded-full object-cover"
                                width="32"
                                height="32"
                                decoding="async"
                                loading="lazy"
                                onError={(e) => { e.target.src = '/images/default-avatar.png' }}
                              />
                            </Link>
                          )}
                          <h3 className="font-bold text-lg">{track.title}</h3>
                        </div>
                        <p className="text-gray-300">
                          {track.artist} {track.album ? `• ${track.album}` : ''}
                        </p>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="bg-gray-700 px-2 py-0.5 text-xs rounded">
                            {track.genres ? track.genres.name : 'No genre'}
                          </span>
                          <span className="text-xs text-gray-400">
                            Shared by{' '}
                            <Link
                              to={`/profile?user=${encodeURIComponent(track.user_id)}`}
                              className="underline hover:text-teal-300"
                            >
                              {track.profiles?.username || 'Anonymous'}
                            </Link>
                            {' '}• {formatDate(track.created_at)}
                          </span>
                          <span className="text-xs text-gray-500">
                            • 🎵 {track.play_count || 0} plays
                            {' '}• ❤️ {likeCounts.get(track.id) || 0} likes
                          </span>
                        </div>
                      </div>
                      
                      <div className="shrink-0 min-w-[200px] flex items-center gap-2 flex-wrap">
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
                              <span className="max-w-[140px] truncate text-xs text-red-400">
                                {player.error}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-red-400">Audio unavailable</span>
                        )}
                        <button
                          type="button"
                          onClick={handleLikeClick}
                          disabled={likesLoading}
                          className={`px-2 py-1 rounded text-sm font-semibold transition ${
                            trackIsLiked
                              ? 'bg-red-500 text-white hover:bg-red-400'
                              : 'bg-gray-700 text-white hover:bg-gray-600'
                          } disabled:opacity-60`}
                        >
                          {trackIsLiked ? '❤️ Liked' : '🤍 Like'}
                        </button>
                        <Suspense fallback={null}>
                          <AddToPlaylist
                            session={session}
                            track={track}
                            buttonClassName="bg-gray-700 text-white px-2 py-1 rounded text-sm hover:bg-gray-600"
                          />
                        </Suspense>
                      </div>
                    </div>
                  </div>

                  {/* Comments section */}
                  {expandedComments === track.id && (
                    <div className="bg-gray-900 p-4 rounded-b mt-0 border-t border-gray-700">
                      <Suspense fallback={<div className="text-gray-400 text-sm">Loading comments…</div>}>
                        <TrackComments trackId={track.id} session={session} />
                      </Suspense>
                    </div>
                  )}

                  {/* Comments toggle button */}
                  <button
                    type="button"
                    onClick={() => setExpandedComments(expandedComments === track.id ? null : track.id)}
                    className="text-xs text-blue-400 hover:underline mt-2 block"
                  >
                    {expandedComments === track.id ? 'Hide comments' : 'View comments'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}