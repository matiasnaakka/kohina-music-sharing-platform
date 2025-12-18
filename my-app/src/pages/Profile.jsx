import { useEffect, useState, lazy, Suspense, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { supabase, getPublicStorageUrl } from '../supabaseclient'
import UserProfile from '../components/UserProfile'
const AddToPlaylist = lazy(() => import('../components/AddToPlaylist'))
const TrackComments = lazy(() => import('../components/TrackComments'))
import { useLikesV2 } from '../hooks/useLikesV2'
import { normalizeUuid } from '../utils/securityUtils'
import FollowModal from '../components/FollowModal'
import GdprExportPanel from '../components/GdprExportPanel'
import ProfileHeader from '../components/ProfileHeader'
import TracksList from '../components/TracksList'
import SidebarPlaylists from '../components/SidebarPlaylists'
import SidebarLikedTracks from '../components/SidebarLikedTracks'
import ProfileSettingsModal from '../components/ProfileSettingsModal'

export default function Profile({ session, player }) {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const rawTargetUserId = searchParams.get('user')

  // Normalize/validate early; if invalid UUID => treat as "no user param".
  const targetUserId = useMemo(() => normalizeUuid(rawTargetUserId), [rawTargetUserId])

  const isOwnProfile = !targetUserId || targetUserId === session?.user?.id
  const [publicProfile, setPublicProfile] = useState(null)
  const [publicTracks, setPublicTracks] = useState([])
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicError, setPublicError] = useState(null)
  const [publicPlaylists, setPublicPlaylists] = useState([])
  const [publicPlaylistsLoading, setPublicPlaylistsLoading] = useState(false)
  const [publicPlaylistsError, setPublicPlaylistsError] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [publicFollowingCount, setPublicFollowingCount] = useState(0)
  const [followError, setFollowError] = useState(null)

  // Own tracks state (unchanged)
  const [ownTracks, setOwnTracks] = useState([])
  const [ownTracksLoading, setOwnTracksLoading] = useState(false)
  const [ownTracksError, setOwnTracksError] = useState(null)

  // NEW: Own header state to mirror public header
  const [ownProfile, setOwnProfile] = useState(null)
  const [ownFollowerCount, setOwnFollowerCount] = useState(0)
  const [ownFollowingCount, setOwnFollowingCount] = useState(0)
  const [ownHeaderLoading, setOwnHeaderLoading] = useState(false)
  const [ownHeaderError, setOwnHeaderError] = useState(null)
  const [ownPlaylists, setOwnPlaylists] = useState([])
  const [ownPlaylistsLoading, setOwnPlaylistsLoading] = useState(false)
  const [ownPlaylistsError, setOwnPlaylistsError] = useState(null)

  // Like count maps (trackId -> like count)
  const [ownLikeCounts, setOwnLikeCounts] = useState(new Map())
  const [publicLikeCounts, setPublicLikeCounts] = useState(new Map())

  const [showSettings, setShowSettings] = useState(false)
  const [followModal, setFollowModal] = useState({ open: false, type: null, userId: null })
  const [followModalUsers, setFollowModalUsers] = useState([])
  const [followModalLoading, setFollowModalLoading] = useState(false)
  const [followModalError, setFollowModalError] = useState(null)

  // NEW: Add missing liked tracks state
  const [likedTracks, setLikedTracks] = useState([])
  const [likedTracksLoading, setLikedTracksLoading] = useState(false)
  const [likedTracksError, setLikedTracksError] = useState(null)
  const [likedTracksLikeCounts, setLikedTracksLikeCounts] = useState(new Map())

  // NEW: Comments expansion state
  const [expandedComments, setExpandedComments] = useState(null)

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

  useEffect(() => {
    if (isOwnProfile || !targetUserId) {
      setPublicProfile(null)
      setPublicTracks([])
      setPublicError(null)
      setPublicPlaylists([]) // FIX: clear public playlists when not viewing another user
      setPublicPlaylistsError(null)
      setPublicPlaylistsLoading(false)
      setIsFollowing(false)
      setFollowerCount(0)
      setPublicFollowingCount(0)
      setFollowError(null)
      setFollowLoading(false)
      return
    }

    let isMounted = true
    const fetchProfile = async () => {
      setPublicLoading(true)
      setPublicError(null)

      if (import.meta.env.DEV) {
        console.debug('[Profile] viewing user', {
          targetUserId,
          rawTargetUserId,
          sessionUserId: session?.user?.id,
          location: window.location.href,
        })
      }

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, bio, location, avatar_url, background_url')
          .eq('id', targetUserId)
          .single()
        if (profileError) throw profileError
        if (!profileData) throw new Error('Profile not found')
        const { data: tracksData, error: tracksError } = await supabase
          .from('tracks')
          .select(`
            id, user_id, title, artist, album, audio_path, created_at, image_path, play_count,
            genres(name),
            profiles!tracks_user_id_fkey(username, avatar_url)
          `)
          .eq('user_id', targetUserId)
          .eq('is_public', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (tracksError) throw tracksError

        setPublicPlaylistsLoading(true)
        setPublicPlaylistsError(null)

        if (import.meta.env.DEV) console.debug('[Profile] playlists query owner=', targetUserId)

        const { data: playlistsData, error: playlistsError } = await supabase
          .from('playlists')
          .select('id, title, description, updated_at, owner, is_public')
          .eq('owner', targetUserId)
          .eq('is_public', true)
          .order('updated_at', { ascending: false })

        if (import.meta.env.DEV) console.debug('[Profile] playlists result', { playlistsData, playlistsError })

        if (playlistsError) throw playlistsError

        const { count: followerCountResult = 0, error: followersError } = await supabase
          .from('followers')
          .select('follower_id', { count: 'exact', head: true })
          .eq('followed_id', targetUserId)
        if (followersError) throw followersError

        const { count: followingCountResult = 0, error: followingCountError } = await supabase
          .from('followers')
          .select('followed_id', { count: 'exact', head: true })
          .eq('follower_id', targetUserId)
        if (followingCountError) throw followingCountError


        // set follow status
        let userFollows = false
        if (session?.user?.id) {
          const { count: followStatusCount = 0, error: followStatusError } = await supabase
            .from('followers')
            .select('follower_id', { count: 'exact', head: true })
            .eq('followed_id', targetUserId)
            .eq('follower_id', session.user.id)
          if (followStatusError) throw followStatusError
          userFollows = followStatusCount > 0
        }

        if (isMounted) {
          setPublicProfile(profileData)
          const safeTracks = tracksData || []
          setPublicTracks(safeTracks)
          setPublicPlaylists(playlistsData || [])
          setPublicPlaylistsError(null)
          setFollowerCount(followerCountResult)
          setPublicFollowingCount(followingCountResult)
          setIsFollowing(userFollows)
          setFollowError(null)
        }
      } catch (err) {
        if (isMounted) {
          setPublicError(err.message)
          setPublicPlaylistsError(err.message)
          setPublicProfile(null)
          setPublicTracks([])
          setPublicPlaylists([])
          setIsFollowing(false)
          setFollowerCount(0)
          setPublicFollowingCount(0)
        }
      } finally {
        if (isMounted) {
          setPublicLoading(false)
          setPublicPlaylistsLoading(false)
          console.log(profileData, "what is this")
        }
      }
    }

    fetchProfile()
    return () => { isMounted = false }
  }, [isOwnProfile, targetUserId, rawTargetUserId, session?.user?.id])

  useEffect(() => {
    if (!isOwnProfile || !session?.user?.id) {
      setOwnTracks([])
      setOwnTracksError(null)
      setOwnTracksLoading(false)
      setOwnPlaylists([])
      setOwnPlaylistsError(null)
      setOwnPlaylistsLoading(false)
      return
    }

    let isMounted = true
    const fetchOwnTracks = async () => {
      setOwnTracksLoading(true)
      setOwnTracksError(null)
      setOwnPlaylistsLoading(true)
      setOwnPlaylistsError(null)
      try {
        const { data, error } = await supabase
          .from('tracks')
          .select(`
            id, user_id, title, artist, album, audio_path, created_at, is_public, image_path, play_count,
            genres(name),
            profiles!tracks_user_id_fkey(username, avatar_url)
          `)
          .eq('user_id', session.user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (isMounted) {
          const safeTracks = data || []
          setOwnTracks(safeTracks)
        }
      } catch (err) {
        if (isMounted) {
          setOwnTracksError(err.message)
          setOwnTracks([])
        }
      } finally {
        if (isMounted) setOwnTracksLoading(false)
      }

      try {
        const { data: playlistsData, error: playlistsError } = await supabase
          .from('playlists')
          .select('id, title, description, is_public, updated_at')
          .eq('owner', session.user.id)
          .eq('is_public', true)
          .order('updated_at', { ascending: false })
        if (playlistsError) throw playlistsError
        if (isMounted) setOwnPlaylists(playlistsData || [])
      } catch (err) {
        if (isMounted) {
          setOwnPlaylistsError(err.message)
          setOwnPlaylists([])
        }
      } finally {
        if (isMounted) setOwnPlaylistsLoading(false)
      }
    }

    fetchOwnTracks()
    return () => { isMounted = false }
  }, [isOwnProfile, session?.user?.id])

  // NEW: Fetch own profile header data (same fields and counts as public header)
  useEffect(() => {
    if (!isOwnProfile || !session?.user?.id) {
      setOwnProfile(null)
      setOwnFollowerCount(0)
      setOwnFollowingCount(0)
      setOwnHeaderError(null)
      setOwnHeaderLoading(false)
      return
    }

    let isMounted = true
    const fetchOwnHeader = async () => {
      setOwnHeaderLoading(true)
      setOwnHeaderError(null)
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, bio, location, avatar_url, background_url')
          .eq('id', session.user.id)
          .single()
        if (profileError) throw profileError

        const { count: followers = 0, error: followersError } = await supabase
          .from('followers')
          .select('follower_id', { count: 'exact', head: true })
          .eq('followed_id', session.user.id)
        if (followersError) throw followersError

        const { count: following = 0, error: followingError } = await supabase
          .from('followers')
          .select('followed_id', { count: 'exact', head: true })
          .eq('follower_id', session.user.id)
        if (followingError) throw followingError

        if (isMounted) {
          setOwnProfile(profileData)
          setOwnFollowerCount(followers)
          setOwnFollowingCount(following)
        }
      } catch (err) {
        if (isMounted) setOwnHeaderError(err.message)
      } finally {
        if (isMounted) setOwnHeaderLoading(false)
      }
    }

    fetchOwnHeader()
    return () => { isMounted = false }
  }, [isOwnProfile, session?.user?.id])

  // Compute like counts for ownTracks
  useEffect(() => {
    const ids = ownTracks.map(t => t.id).filter(Boolean)
    if (!ids.length) {
      setOwnLikeCounts(new Map())
      return
    }

    let isMounted = true
    const fetchOwnLikeCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('track_likes')
          .select('track_id')
          .in('track_id', ids)

        if (error) throw error

        const counts = new Map()
        for (const row of data || []) {
          const tid = row.track_id
          counts.set(tid, (counts.get(tid) || 0) + 1)
        }
        if (isMounted) setOwnLikeCounts(counts)
      } catch {
        if (isMounted) setOwnLikeCounts(new Map())
      }
    }

    fetchOwnLikeCounts()
    return () => {
      isMounted = false
    }
  }, [ownTracks])

  // Compute like counts for publicTracks
  useEffect(() => {
    const ids = publicTracks.map(t => t.id).filter(Boolean)
    if (!ids.length) {
      setPublicLikeCounts(new Map())
      return
    }

    let isMounted = true
    const fetchPublicLikeCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('track_likes')
          .select('track_id')
          .in('track_id', ids)

        if (error) throw error

        const counts = new Map()
        for (const row of data || []) {
          const tid = row.track_id
          counts.set(tid, (counts.get(tid) || 0) + 1)
        }
        if (isMounted) setPublicLikeCounts(counts)
      } catch {
        if (isMounted) setPublicLikeCounts(new Map())
      }
    }

    fetchPublicLikeCounts()
    return () => {
      isMounted = false
    }
  }, [publicTracks])

  const handleFollowToggle = async () => {
    if (!session?.user?.id || !targetUserId) return
    setFollowError(null)
    setFollowLoading(true)
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('followed_id', targetUserId)
        if (error) throw error
        setIsFollowing(false)
        setFollowerCount((prev) => Math.max(0, (prev || 0) - 1))
      } else {
        const { error } = await supabase
          .from('followers')
          .insert([{ follower_id: session.user.id, followed_id: targetUserId }])
        if (error && error.code !== '23505') throw error
        setIsFollowing(true)
        if (!error) {
          setFollowerCount((prev) => (prev || 0) + 1)
        }
      }
    } catch (err) {
      setFollowError(err.message)
    } finally {
      setFollowLoading(false)
    }
  }

  const fetchFollowList = async (type, userId) => {
    const relationColumn = type === 'followers' ? 'followed_id' : 'follower_id'
    const selectColumn = type === 'followers' ? 'follower_id' : 'followed_id'
    const { data, error } = await supabase
      .from('followers')
      .select(selectColumn)
      .eq(relationColumn, userId)

    if (error) throw error
    const ids = Array.from(new Set((data || []).map((row) => row[selectColumn])))
    if (!ids.length) return []
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', ids)

    if (profilesError) throw profilesError
    return (profilesData || []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  }

  const openFollowModal = async (type, userId) => {
    if (!userId) return
    setFollowModal({ open: true, type, userId })
    setFollowModalUsers([])
    setFollowModalError(null)
    setFollowModalLoading(true)
    try {
      const users = await fetchFollowList(type, userId)
      setFollowModalUsers(users)
    } catch (err) {
      setFollowModalError(err.message)
    } finally {
      setFollowModalLoading(false)
    }
  }

  const closeFollowModal = () => {
    setFollowModal({ open: false, type: null, userId: null })
    setFollowModalUsers([])
    setFollowModalError(null)
  }

  const handleProfileSelect = (userId) => {
    closeFollowModal()
    if (!userId) return
    navigate(userId === session?.user?.id ? '/profile' : `/profile?user=${userId}`)
  }

  // Like handlers
  const { isLiked: isOwnTrackLiked, toggleLike: toggleOwnTrackLike, fetchLikedTracks: fetchOwnLikedTracks } = useLikesV2(session?.user?.id)
  const { isLiked: isPublicTrackLiked, toggleLike: togglePublicTrackLike, fetchLikedTracks: fetchPublicLikedTracks } = useLikesV2(session?.user?.id)
  const { isLiked: isLikedTrackLiked, toggleLike: toggleLikedTrackLike, fetchLikedTracks: fetchLikedTracksTracks } = useLikesV2(session?.user?.id)

  // Fetch liked tracks when component mounts or user changes
  useEffect(() => {
    if (!isOwnProfile || !session?.user?.id) {
      setLikedTracks([])
      return
    }

    let isMounted = true
    const fetchLikedTracks = async () => {
      setLikedTracksLoading(true)
      setLikedTracksError(null)
      try {
        const { data, error } = await supabase
          .from('track_likes')
          .select(`
            track_id,
            created_at,
            tracks (
              id,
              title,
              artist,
              album,
              audio_path,
              created_at,
              image_path,
              user_id,
              play_count,
              genres (name),
              profiles!tracks_user_id_fkey(username, avatar_url)
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        const mappedTracks = (data || [])
          .filter(item => item.tracks)
          .map(item => item.tracks)

        if (isMounted) {
          setLikedTracks(mappedTracks)
          // Fetch like state for these tracks
          if (mappedTracks.length > 0) {
            fetchLikedTracksTracks(mappedTracks.map(t => t.id))
          }
        }
      } catch (err) {
        if (isMounted) {
          setLikedTracksError(err.message)
          setLikedTracks([])
          setLikedTracksLikeCounts(new Map())
        }
      } finally {
        if (isMounted) setLikedTracksLoading(false)
      }
    }

    fetchLikedTracks()
    return () => { isMounted = false }
  }, [isOwnProfile, session?.user?.id, fetchLikedTracksTracks])

  // Compute like counts for liked tracks
  useEffect(() => {
    const ids = likedTracks.map((t) => t.id).filter(Boolean)
    if (!ids.length) {
      setLikedTracksLikeCounts(new Map())
      return
    }

    let active = true
    const loadCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('track_likes')
          .select('track_id')
          .in('track_id', ids)

        if (error) throw error

        const counts = new Map()
        for (const row of data || []) {
          const tid = row.track_id
          counts.set(tid, (counts.get(tid) || 0) + 1)
        }
        if (active) setLikedTracksLikeCounts(counts)
      } catch (err) {
        if (active) setLikedTracksLikeCounts(new Map())
      }
    }

    loadCounts()
    return () => { active = false }
  }, [likedTracks])

  // Fetch liked tracks when own tracks load
  useEffect(() => {
    const trackIds = ownTracks.map(t => t.id)
    if (trackIds.length > 0) {
      fetchOwnLikedTracks(trackIds)
    }
  }, [ownTracks, fetchOwnLikedTracks])

  // Fetch liked tracks when public tracks load
  useEffect(() => {
    const trackIds = publicTracks.map(t => t.id)
    if (trackIds.length > 0) {
      fetchPublicLikedTracks(trackIds)
    }
  }, [publicTracks, fetchPublicLikedTracks])

  // Close modal on Escape
  useEffect(() => {
    if (!followModal.open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeFollowModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [followModal.open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={handleSignOut} />
      {isOwnProfile ? (
        <>
          <div className="max-w-5xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg text-white pb-32 md:pb-6">
            {ownHeaderLoading ? (
              <div>Loading profile...</div>
            ) : ownHeaderError ? (
              <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{ownHeaderError}</div>
            ) : !ownProfile ? (
              <div className="text-gray-300">Profile not found.</div>
            ) : (
              <>
                <ProfileHeader
                  profile={ownProfile}
                  isOwn
                  followerCount={ownFollowerCount}
                  followingCount={ownFollowingCount}
                  onFollowersClick={() => openFollowModal('followers', session?.user?.id)}
                  onFollowingClick={() => openFollowModal('following', session?.user?.id)}
                  onEditProfile={() => setShowSettings(true)}
                />
                <h3 className="text-2xl font-bold mb-4">Tracks</h3>
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-[1.2] min-w-0">
                    <TracksList
                      tracks={ownTracks}
                      loading={ownTracksLoading}
                      error={ownTracksError}
                      profileAvatar={ownProfile?.avatar_url}
                      player={player}
                      session={session}
                      isOwn
                      formatDate={formatDate}
                      expandedComments={expandedComments}
                      onToggleComments={(id) => setExpandedComments(id === expandedComments ? null : id)}
                      isTrackLiked={isOwnTrackLiked}
                      onToggleLike={toggleOwnTrackLike}
                      likeCounts={ownLikeCounts}
                      emptyMessage="You haven't uploaded any tracks yet."
                    />
                  </div>
                  <div className="lg:w-64 space-y-6">
                    <SidebarPlaylists
                      title="Public playlists"
                      playlists={ownPlaylists}
                      loading={ownPlaylistsLoading}
                      error={ownPlaylistsError}
                    />
                    <SidebarLikedTracks
                      tracks={likedTracks}
                      loading={likedTracksLoading}
                      error={likedTracksError}
                      player={player}
                      session={session}
                      isTrackLiked={isLikedTrackLiked}
                      onToggleLike={toggleLikedTrackLike}
                      likeCounts={likedTracksLikeCounts}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <ProfileSettingsModal
            open={showSettings}
            session={session}
            onClose={() => setShowSettings(false)}
          />

          <FollowModal
            open={followModal.open}
            type={followModal.type}
            loading={followModalLoading}
            error={followModalError}
            users={followModalUsers}
            onClose={closeFollowModal}
            onSelectUser={handleProfileSelect}
          />
        </>
      ) : (
        <div className="max-w-5xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg text-white pb-32 md:pb-6">
          {publicLoading ? (
            <div>Loading profile...</div>
          ) : publicError ? (
            <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{publicError}</div>
          ) : !publicProfile ? (
            <div className="text-gray-300">Profile not found.</div>
          ) : (
            <>
              <ProfileHeader
                profile={publicProfile}
                isOwn={false}
                followerCount={followerCount}
                followingCount={publicFollowingCount}
                onFollowersClick={() => openFollowModal('followers', targetUserId)}
                onFollowingClick={() => openFollowModal('following', targetUserId)}
                onFollowToggle={handleFollowToggle}
                followLoading={followLoading}
                isFollowing={isFollowing}
                followError={followError}
              />
              <h3 className="text-2xl font-bold mb-4">Tracks</h3>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-[1.2] min-w-0">
                  <TracksList
                    tracks={publicTracks}
                    loading={false}
                    error={null}
                    profileAvatar={publicProfile?.avatar_url}
                    player={player}
                    session={session}
                    isOwn={false}
                    formatDate={formatDate}
                    expandedComments={expandedComments}
                    onToggleComments={(id) => setExpandedComments(id === expandedComments ? null : id)}
                    isTrackLiked={isPublicTrackLiked}
                    onToggleLike={togglePublicTrackLike}
                      likeCounts={publicLikeCounts}
                    emptyMessage="No public tracks yet."
                  />
                </div>
                <div className="lg:w-64 space-y-6">
                  <SidebarPlaylists
                    title="Public playlists"
                    playlists={publicPlaylists}
                    loading={publicPlaylistsLoading}
                    error={publicPlaylistsError}
                  />
                  <SidebarLikedTracks
                    tracks={likedTracks}
                    loading={likedTracksLoading}
                    error={likedTracksError}
                    player={player}
                    session={session}
                    isTrackLiked={isLikedTrackLiked}
                    onToggleLike={toggleLikedTrackLike}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
