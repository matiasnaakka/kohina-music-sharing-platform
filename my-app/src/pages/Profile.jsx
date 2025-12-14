import { useEffect, useState, lazy, Suspense, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { supabase, getPublicStorageUrl } from '../supabaseclient'
import UserProfile from '../components/UserProfile'
const AddToPlaylist = lazy(() => import('../components/AddToPlaylist'))
const TrackComments = lazy(() => import('../components/TrackComments'))
import { useLikesV2 } from '../hooks/useLikesV2'
import { normalizeUuid } from '../utils/securityUtils'

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

  const [showSettings, setShowSettings] = useState(false)
  const [followModal, setFollowModal] = useState({ open: false, type: null, userId: null })
  const [followModalUsers, setFollowModalUsers] = useState([])
  const [followModalLoading, setFollowModalLoading] = useState(false)
  const [followModalError, setFollowModalError] = useState(null)

  // NEW: Add missing liked tracks state
  const [likedTracks, setLikedTracks] = useState([])
  const [likedTracksLoading, setLikedTracksLoading] = useState(false)
  const [likedTracksError, setLikedTracksError] = useState(null)

  // NEW: Comments expansion state
  const [expandedComments, setExpandedComments] = useState(null)

  // NEW: GDPR export state
  const [gdprExportLoading, setGdprExportLoading] = useState(false)
  const [gdprExportError, setGdprExportError] = useState(null)
  const [gdprExportResult, setGdprExportResult] = useState(null)
  const [gdprExportDownloadInfo, setGdprExportDownloadInfo] = useState(null) // NEW

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
          .select('username, bio, location, avatar_url')
          .eq('id', targetUserId)
          .single()
        if (profileError) throw profileError
        if (!profileData) throw new Error('Profile not found')

        const { data: tracksData, error: tracksError } = await supabase
          .from('tracks')
          .select(`
            id, title, artist, album, audio_path, created_at, image_path, play_count,
            genres(name)
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
          setPublicTracks(tracksData || [])
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
            id, title, artist, album, audio_path, created_at, is_public, image_path, play_count,
            genres(name)
          `)
          .eq('user_id', session.user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (isMounted) setOwnTracks(data || [])
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
          .select('username, bio, location, avatar_url')
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
        }
      } finally {
        if (isMounted) setLikedTracksLoading(false)
      }
    }

    fetchLikedTracks()
    return () => { isMounted = false }
  }, [isOwnProfile, session?.user?.id, fetchLikedTracksTracks])

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

  // NEW: minimal JWT helpers (safe logging only)
  const isJwtLike = (token) => typeof token === 'string' && token.split('.').length === 3
  const tryGetJwtExpIso = (token) => {
    try {
      if (!isJwtLike(token)) return null
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const json = JSON.parse(atob(base64))
      return json?.exp ? new Date(json.exp * 1000).toISOString() : null
    } catch {
      return null
    }
  }

  // NEW: keep auth token fresh-ish (edge function requires unexpired access token)
  const getFreshAccessToken = async () => {
    const { data: s1, error: e1 } = await supabase.auth.getSession()
    if (e1) throw e1
    let current = s1?.session

    if (!current) throw new Error('Not authenticated.')

    const expiresAtMs = (current.expires_at || 0) * 1000
    const shouldRefresh = expiresAtMs && expiresAtMs < Date.now() + 30_000
    if (shouldRefresh) {
      const { data: s2, error: e2 } = await supabase.auth.refreshSession()
      if (e2) throw e2
      current = s2?.session || current
    }

    if (!current?.access_token) throw new Error('Missing access token.')
    return current.access_token
  }

  // NEW: functions base URL helper (works for both env + supabase-js)
  const getFunctionsBaseUrl = () => {
    const base =
      (supabase?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
    if (!base) throw new Error('Missing Supabase URL (VITE_SUPABASE_URL).')
    return `${base}/functions/v1`
  }

  const parseFilenameFromContentDisposition = (cd) => {
    if (!cd) return null
    // e.g. attachment; filename="gdpr-export-123.gz"
    const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd)
    if (!m?.[1]) return null
    try {
      return decodeURIComponent(m[1])
    } catch {
      return m[1]
    }
  }

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'gdpr-export'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // NEW: call Edge Function and handle binary attachment OR JSON
  const handleGdprExport = async () => {
    setGdprExportError(null)
    setGdprExportResult(null)
    setGdprExportDownloadInfo(null)
    setGdprExportLoading(true)

    try {
      const token = await getFreshAccessToken()

      if (import.meta.env.DEV) {
        console.debug('[GDPR export] token meta', {
          len: token?.length || 0,
          jwtLike: isJwtLike(token),
          exp: tryGetJwtExpIso(token),
          sessionUserId: session?.user?.id,
        })
      }

      const url = `${getFunctionsBaseUrl()}/gdpr-export`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          // allow either mode if your function ever returns JSON; otherwise it’ll just be an attachment
          Accept: 'application/json, application/octet-stream, application/gzip, */*',
        },
        body: JSON.stringify({}),
      })

      const contentType = res.headers.get('content-type') || ''
      const contentDisposition = res.headers.get('content-disposition') || ''

      if (import.meta.env.DEV) {
        console.debug('[GDPR export] response meta', {
          status: res.status,
          contentType,
          contentDisposition,
        })
      }

      if (!res.ok) {
        // Try to surface useful error text from function
        const text = await res.text().catch(() => '')
        throw new Error(text || `Export failed (HTTP ${res.status}).`)
      }

      // If the function returns JSON, keep your existing UI (raw JSON + Download JSON)
      if (contentType.includes('application/json')) {
        const data = await res.json()
        setGdprExportResult(data)
        return
      }

      // Otherwise treat as file download (gzip/zip/etc)
      const blob = await res.blob()
      const filename =
        parseFilenameFromContentDisposition(contentDisposition) ||
        // fallback guesses
        (contentType.includes('application/zip') ? 'gdpr-export.zip' :
          contentType.includes('application/gzip') ? 'gdpr-export.gz' :
          'gdpr-export.bin')

      downloadBlob(blob, filename)
      setGdprExportDownloadInfo(`Downloaded: ${filename}`)
    } catch (err) {
      setGdprExportError(err?.message || 'Export failed.')
    } finally {
      setGdprExportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={handleSignOut} />
      {isOwnProfile ? (
        <>
          {/* Unified header + tracks container (same as public layout) */}
          <div className="max-w-4xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg text-white pb-32 md:pb-6">
            {ownHeaderLoading ? (
              <div>Loading profile...</div>
            ) : ownHeaderError ? (
              <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{ownHeaderError}</div>
            ) : !ownProfile ? (
              <div className="text-gray-300">Profile not found.</div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row items-start gap-4 mb-6">
                  <img
                    src={ownProfile.avatar_url || '/default-avatar.png'}
                    alt={`${ownProfile.username}'s avatar`}
                    className="w-24 h-24 object-cover"
                    width="96"
                    height="96"
                    decoding="async"
                    loading="lazy"
                    onError={(e) => { e.target.src = '/default-avatar.png' }}
                  />
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold mb-1">{ownProfile.username}</h2>
                    {ownProfile.location && (
                      <p className="text-sm text-gray-300 mb-2">{ownProfile.location}</p>
                    )}
                    {ownProfile.bio && (
                      <p className="text-gray-200 whitespace-pre-line">{ownProfile.bio}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-2 md:ml-auto">
                    <button
                      onClick={() => setShowSettings(true)}
                      className="px-4 py-2 rounded font-semibold bg-cyan-500 text-white hover:bg-cyan-700"
                    >
                      Profile settings
                    </button>
                    <span className="text-xl text-gray-400 space-x-2">
                      <button
                        type="button"
                        onClick={() => openFollowModal('followers', session?.user?.id)}
                        className="hover:text-white underline-offset-2 hover:underline"
                      >
                        {ownFollowerCount === 1 ? '1 follower' : `${ownFollowerCount} followers`}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => openFollowModal('following', session?.user?.id)}
                        className="hover:text-white underline-offset-2 hover:underline"
                      >
                        Following {ownFollowingCount}
                      </button>
                    </span>
                  </div>
                </div>

                <h3 className="text-2xl font-bold mb-4">Tracks</h3>
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    {ownTracksLoading ? (
                      <div>Loading your tracks...</div>
                    ) : ownTracksError ? (
                      <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">
                        {ownTracksError}
                      </div>
                    ) : ownTracks.length === 0 ? (
                      <div className="text-gray-300 bg-gray-800 p-4 rounded">
                        You haven't uploaded any tracks yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {ownTracks.map((track, idx) => {
                          const coverSrc =
                            getPublicStorageUrl('track-images', track.image_path) ||
                            ownProfile?.avatar_url ||
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
                          const trackIsLiked = isOwnTrackLiked(track.id)
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
                                  onError={(e) => { e.target.src = ownProfile?.avatar_url || '/default-avatar.png' }}
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
                                      <span className="bg-gray-700 px-2 py-0.5 text-xs rounded">
                                        {track.is_public ? 'Public' : 'Private'}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {formatDate(track.created_at)}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        • 🎵 {track.play_count || 0} plays
                                      </span>
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
                                      onClick={() => toggleOwnTrackLike(track.id)}
                                      className={`px-2 py-1 rounded text-sm font-semibold transition ${
                                        trackIsLiked
                                          ? 'bg-red-500 text-white hover:bg-red-400'
                                          : 'bg-gray-700 text-white hover:bg-gray-600'
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
                  <div className="lg:w-72 space-y-6">
                    {/* Public Playlists Sidebar */}
                    <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
                      <h4 className="text-xl font-semibold mb-3">Public playlists</h4>
                      {ownPlaylistsLoading ? (
                        <div className="text-gray-400 text-sm">Loading playlists...</div>
                      ) : ownPlaylistsError ? (
                        <div className="text-red-400 text-sm">{ownPlaylistsError}</div>
                      ) : ownPlaylists.length === 0 ? (
                        <div className="text-gray-400 text-sm">No public playlists yet.</div>
                      ) : (
                        <ul className="space-y-3 text-sm">
                          {ownPlaylists.map((playlist) => (
                            <li key={playlist.id}>
                              <Link
                                to={`/playlist?id=${playlist.id}`}
                                className="block bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition"
                              >
                                <p className="text-white font-semibold">{playlist.title}</p>
                                {playlist.description && (
                                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{playlist.description}</p>
                                )}
                                <p className="text-gray-500 text-xs mt-1">
                                  Updated {new Date(playlist.updated_at).toLocaleDateString()}
                                </p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </aside>

                    {/* Liked Tracks Sidebar */}
                    <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
                      <h4 className="text-xl font-semibold mb-3">Liked Tracks</h4>
                      {likedTracksLoading ? (
                        <div className="text-gray-400 text-sm">Loading...</div>
                      ) : likedTracksError ? (
                        <div className="text-red-400 text-sm">{likedTracksError}</div>
                      ) : likedTracks.length === 0 ? (
                        <div className="text-gray-400 text-sm">No liked tracks yet.</div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {likedTracks.map((track) => {
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
                            const trackIsLiked = isLikedTrackLiked(track.id)
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
                                    onError={(e) => { e.target.src = track.profiles?.avatar_url || '/default-avatar.png' }}
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
                                    <p className="text-gray-500 text-xs mt-1">
                                      🎵 {track.play_count || 0} plays
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {canPlay ? (
                                    <button
                                      type="button"
                                      onClick={handlePlayback}
                                      disabled={isBusy}
                                      className="bg-teal-500 text-black px-1.5 py-0.5 rounded text-xs font-semibold hover:bg-teal-400 disabled:opacity-60"
                                    >
                                      {playbackLabel}
                                    </button>
                                  ) : (
                                    <span className="text-red-400 text-xs">No audio</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleLikedTrackLike(track.id)}
                                    className={`px-1 py-0.5 rounded text-xs transition ${
                                      trackIsLiked
                                        ? 'bg-red-500 text-white hover:bg-red-400'
                                        : 'bg-gray-700 text-white hover:bg-gray-600'
                                    }`}
                                  >
                                    {trackIsLiked ? '❤️' : '🤍'}
                                  </button>
                                  <Suspense fallback={null}>
                                    <AddToPlaylist session={session} track={track} />
                                  </Suspense>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </aside>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Settings Modal (editable) */}
          {showSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="w-full max-w-lg mx-4 space-y-4">
                {/* UserProfile component for editable settings */}
                <UserProfile
                  session={session}
                  isModal
                  onClose={() => {
                    setShowSettings(false)
                    // NEW: reset export UI on close
                    setGdprExportLoading(false)
                    setGdprExportError(null)
                    setGdprExportResult(null)
                    setGdprExportDownloadInfo(null) // NEW
                  }}
                />

                {/* NEW: GDPR export panel */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-lg font-semibold">Export my data</h4>
                      <p className="text-sm text-gray-400">
                        Generates a JSON export (with signed URLs where applicable).
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGdprExport}
                        disabled={gdprExportLoading}
                        className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-sm font-semibold"
                      >
                        {gdprExportLoading ? 'Exporting…' : 'Download export'}
                      </button>

                      <button
                        type="button"
                        onClick={downloadGdprJson}
                        disabled={!gdprExportResult}
                        className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-sm"
                        title="Enabled only if the function returns JSON"
                      >
                        Download JSON
                      </button>
                    </div>
                  </div>

                  {gdprExportError && (
                    <div className="mt-3 text-sm text-red-400">{gdprExportError}</div>
                  )}

                  {gdprExportDownloadInfo && (
                    <div className="mt-3 text-sm text-green-300">{gdprExportDownloadInfo}</div>
                  )}

                  {!!gdprExportResult && (
                    <div className="mt-3 space-y-3">
                      {/* If your function returns URLs in a known place, render links. Otherwise just show JSON. */}
                      {Array.isArray(gdprExportResult?.export?.files) && gdprExportResult.export.files.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold mb-2">Files</div>
                          <ul className="space-y-1 text-sm">
                            {gdprExportResult.export.files.map((f, i) => (
                              <li key={f?.url || i} className="truncate">
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-teal-300 hover:underline"
                                >
                                  {f.name || f.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <details className="bg-gray-950/40 border border-gray-800 rounded p-3">
                        <summary className="cursor-pointer text-sm text-gray-300">View raw JSON</summary>
                        <pre className="mt-2 text-xs text-gray-300 overflow-x-auto">
                          {JSON.stringify(gdprExportResult, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="max-w-4xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg text-white pb-32 md:pb-6">
          {publicLoading ? (
            <div>Loading profile...</div>
          ) : publicError ? (
            <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded">{publicError}</div>
          ) : !publicProfile ? (
            <div className="text-gray-300">Profile not found.</div>
          ) : (
            <div>
              <div className="flex flex-col md:flex-row items-start gap-4 mb-6">
                <img
                  src={publicProfile.avatar_url || '/default-avatar.png'}
                  alt={`${publicProfile.username}'s avatar`}
                  className="w-24 h-24 object-cover"
                  width="96"
                  height="96"
                  decoding="async"
                  loading="lazy"
                  onError={(e) => { e.target.src = '/default-avatar.png' }}
                />
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-1">{publicProfile.username}</h2>
                  {publicProfile.location && (
                    <p className="text-sm text-gray-300 mb-2">{publicProfile.location}</p>
                  )}
                  {publicProfile.bio && (
                    <p className="text-gray-200 whitespace-pre-line">{publicProfile.bio}</p>
                  )}
                </div>
                <div className="flex flex-col items-start md:items-end gap-2 md:ml-auto">
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`px-4 py-2 rounded-2xl font-semibold transition ${
                      followLoading ? 'opacity-70 cursor-not-allowed' : ''
                    } ${
                      isFollowing
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-amber-500 text-white hover:bg-amber-300'
                    }`}
                  >
                    {followLoading ? 'Processing...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                  <span className="text-2xl text-gray-400 space-x-2">
                    <button
                      type="button"
                      onClick={() => openFollowModal('followers', targetUserId)}
                      className="hover:text-white underline-offset-2 hover:underline"
                    >
                      {followerCount === 1 ? '1 follower' : `${followerCount} followers`}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => openFollowModal('following', targetUserId)}
                      className="hover:text-white underline-offset-2 hover:underline"
                    >
                      Following {publicFollowingCount}
                    </button>
                  </span>
                  {followError && (
                    <span className="text-2xl text-red-400">{followError}</span>
                  )}
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-4">Tracks</h3>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  {publicTracks.length === 0 ? (
                    <div className="text-gray-300 bg-gray-800 p-4 rounded">
                      No public tracks yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {publicTracks.map((track, idx) => {
                        const coverSrc =
                          getPublicStorageUrl('track-images', track.image_path) ||
                          publicProfile?.avatar_url ||
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
                        const trackIsLiked = isPublicTrackLiked(track.id)
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
                                onError={(e) => { e.target.src = publicProfile?.avatar_url || '/default-avatar.png' }}
                              />
                              <div className="flex flex-col md:flex-row justify-between flex-1">
                                <div>
                                  <h4 className="font-bold text-lg">{track.title}</h4>
                                  <p className="text-gray-300">
                                    {track.artist} {track.album ? `• ${track.album}` : ''}
                                  </p>
                                  <div className="flex gap-2 items-center mt-1">
                                    <span className="bg-gray-700 px-2 py-0.5 text-xs rounded">
                                      {track.genres ? track.genres.name : 'No genre'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {formatDate(track.created_at)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      • 🎵 {track.play_count || 0} plays
                                    </span>
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
                                    onClick={() => togglePublicTrackLike(track.id)}
                                    className={`px-2 py-1 rounded text-sm font-semibold transition ${
                                      trackIsLiked
                                        ? 'bg-red-500 text-white hover:bg-red-400'
                                        : 'bg-gray-700 text-white hover:bg-gray-600'
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
                <div className="lg:w-72 space-y-6">
                  {/* Public Playlists Sidebar */}
                  <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
                    <h4 className="text-xl font-semibold mb-3">Public playlists</h4>
                    {publicPlaylistsLoading ? (
                      <div className="text-gray-400 text-sm">Loading playlists...</div>
                    ) : publicPlaylistsError ? (
                      <div className="text-red-400 text-sm">{publicPlaylistsError}</div>
                    ) : publicPlaylists.length === 0 ? (
                      <div className="text-gray-400 text-sm">No public playlists yet.</div>
                    ) : (
                      <ul className="space-y-3 text-sm">
                        {publicPlaylists.map((playlist) => (
                          <li key={playlist.id}>
                            <Link
                              to={`/playlist?id=${playlist.id}`}
                              className="block bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition"
                            >
                              <p className="text-white font-semibold">{playlist.title}</p>
                              {playlist.description && (
                                <p className="text-gray-400 text-xs mt-1 line-clamp-2">{playlist.description}</p>
                              )}
                              <p className="text-gray-500 text-xs mt-1">
                                Updated {new Date(playlist.updated_at).toLocaleDateString()}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </aside>

                  {/* Liked Tracks Sidebar */}
                  <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
                    <h4 className="text-xl font-semibold mb-3">Liked Tracks</h4>
                    {likedTracksLoading ? (
                      <div className="text-gray-400 text-sm">Loading...</div>
                    ) : likedTracksError ? (
                      <div className="text-red-400 text-sm">{likedTracksError}</div>
                    ) : likedTracks.length === 0 ? (
                      <div className="text-gray-400 text-sm">No liked tracks yet.</div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {likedTracks.map((track) => {
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
                          const trackIsLiked = isLikedTrackLiked(track.id)
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
                                  onError={(e) => { e.target.src = track.profiles?.avatar_url || '/default-avatar.png' }}
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
                                  <p className="text-gray-500 text-xs mt-1">
                                    🎵 {track.play_count || 0} plays
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {canPlay ? (
                                  <button
                                    type="button"
                                    onClick={handlePlayback}
                                    disabled={isBusy}
                                    className="bg-teal-500 text-black px-1.5 py-0.5 rounded text-xs font-semibold hover:bg-teal-400 disabled:opacity-60"
                                  >
                                    {playbackLabel}
                                  </button>
                                ) : (
                                  <span className="text-red-400 text-xs">No audio</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleLikedTrackLike(track.id)}
                                  className={`px-1 py-0.5 rounded text-xs transition ${
                                    trackIsLiked
                                      ? 'bg-red-500 text-white hover:bg-red-400'
                                      : 'bg-gray-700 text-white hover:bg-gray-600'
                                  }`}
                                >
                                  {trackIsLiked ? '❤️' : '🤍'}
                                </button>
                                <Suspense fallback={null}>
                                  <AddToPlaylist session={session} track={track} />
                                </Suspense>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOLLOW MODAL (was missing UI, so buttons looked broken) */}
      {followModal.open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            // backdrop click closes
            if (e.target === e.currentTarget) closeFollowModal()
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-gray-900 border border-gray-800 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-lg font-semibold">
                {followModal.type === 'followers' ? 'Followers' : 'Following'}
              </h3>
              <button
                type="button"
                onClick={closeFollowModal}
                className="text-gray-300 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {followModalLoading ? (
                <div className="text-sm text-gray-400">Loading…</div>
              ) : followModalError ? (
                <div className="text-sm text-red-400">{followModalError}</div>
              ) : followModalUsers.length === 0 ? (
                <div className="text-sm text-gray-400">No users found.</div>
              ) : (
                <ul className="max-h-96 overflow-y-auto space-y-2"></ul>
                  {followModalUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => handleProfileSelect(u.id)}
                        className="w-full flex items-center gap-3 rounded bg-gray-800 hover:bg-gray-700 px-3 py-2 text-left"
                      >
                        <img
                          src={u.avatar_url || '/default-avatar.png'}
                          alt={u.username || 'User'}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                          width="40"
                          height="40"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { e.target.src = '/default-avatar.png' }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{u.username || 'Anonymous'}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={closeFollowModal}
                className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
