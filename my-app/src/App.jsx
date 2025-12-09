import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import Routing from './Router'
import { supabase, getPublicStorageUrl } from './supabaseclient'
import { useIncrementPlayCount } from './hooks/useIncrementPlayCount'

/*
  App.jsx
  - Manages a global audio player (play, pause, resume, stop).
  - Creates a 'player' API object that is passed down via Routing -> pages.
  - Handles fetching signed URLs for private audio stored in Supabase storage.
*/

const initialPlayerState = {
  track: null,
  signedUrl: null,
  isPlaying: false,
  loading: false,
  error: null,
}

const App = () => {
  const [playerState, setPlayerState] = useState(initialPlayerState)
  const [session, setSession] = useState(null)
  const audioRef = useRef(null)

  // Fetch current session on mount
  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(session)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription?.unsubscribe()
  }, [])

  /**
   * playTrack
   * - Given a track record, create a signed URL for the audio file and start playback.
   */
  const playTrack = useCallback(async (track) => {
    if (!track?.audio_path) {
      setPlayerState({
        track,
        signedUrl: null,
        isPlaying: false,
        loading: false,
        error: 'Audio unavailable for this track.',
      })
      return
    }
    setPlayerState((prev) => ({
      ...prev,
      track,
      loading: true,
      error: null,
    }))
    try {
      const { data, error } = await supabase.storage
        .from('audio')
        .createSignedUrl(track.audio_path, 3600)
      if (error) throw error
      setPlayerState({
        track,
        signedUrl: data.signedUrl,
        isPlaying: true,
        loading: false,
        error: null,
      })
    } catch (err) {
      setPlayerState((prev) => ({
        ...prev,
        loading: false,
        isPlaying: false,
        error: err.message,
      }))
    }
  }, [])

  /**
   * pause/resume/stop functions
   * - Control the HTMLAudioElement referenced by audioRef.
   * - Update shared playerState accordingly.
   */
  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setPlayerState((prev) => ({
      ...prev,
      isPlaying: false,
      loading: false,
      error: null,
    }))
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setPlayerState((prev) => ({ ...prev, loading: true, error: null }))
    audio
      .play()
      .then(() => {
        setPlayerState((prev) => ({
          ...prev,
          isPlaying: true,
          loading: false,
          error: null,
        }))
      })
      .catch((err) =>
        setPlayerState((prev) => ({
          ...prev,
          loading: false,
          error: err.message,
        })),
      )
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audio.removeAttribute('src')
      audio.load()
    }
    setPlayerState(initialPlayerState)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const handlePlay = () =>
      setPlayerState((prev) => ({
        ...prev,
        isPlaying: true,
        loading: false,
      }))
    const handlePause = () =>
      setPlayerState((prev) => ({
        ...prev,
        isPlaying: false,
      }))
    const handleEnded = () => {
      audio.currentTime = 0
      setPlayerState((prev) => ({
        ...prev,
        isPlaying: false,
      }))
    }
    const handleError = () =>
      setPlayerState((prev) => ({
        ...prev,
        isPlaying: false,
        error: 'Playback error. Please try again.',
      }))

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [audioRef.current])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playerState.signedUrl) return
    audio.src = playerState.signedUrl
    audio
      .play()
      .catch((err) =>
        setPlayerState((prev) => ({
          ...prev,
          error: err.message,
          isPlaying: false,
        })),
      )
  }, [playerState.signedUrl])

  // player object passed to pages for controlling playback
  const player = useMemo(
    () => ({
      currentTrack: playerState.track,
      isPlaying: playerState.isPlaying,
      loading: playerState.loading,
      error: playerState.error,
      playTrack,
      pause,
      resume,
      stop,
    }),
    [playerState, playTrack, pause, resume, stop],
  )

  return (
    <>
      <Routing player={player} />
      <GlobalAudioPlayer
        audioRef={audioRef}
        playerState={playerState}
        pause={pause}
        resume={resume}
        stop={stop}
        session={session}
      />
    </>
  )
}

// GlobalAudioPlayer component renders the bottom player UI
const GlobalAudioPlayer = ({ audioRef, playerState, pause, resume, stop, session }) => {
  const { track, isPlaying, loading, error } = playerState
  const { increment: incrementPlayCount } = useIncrementPlayCount()
  const timerRef = useRef(null)

  const THRESHOLD_MS = 5000 // 5 seconds continuous playback
  const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track?.id) return

    // Include user ID in the session key so each user has their own cooldown per track
    const sessionKey = `played:${track.id}:${session?.user?.id || 'anonymous'}`

    const startTimer = () => {
      console.log('[GlobalAudioPlayer] startTimer called for track:', track?.id, 'user:', session?.user?.id)

      // Skip if recently incremented
      try {
        const last = sessionStorage.getItem(sessionKey)
        const now = Date.now()
        const timeSinceLast = last ? now - Number(last) : null
        const cooldownRemaining = last ? COOLDOWN_MS - timeSinceLast : 0

        console.log('[GlobalAudioPlayer] Cooldown check:', {
          sessionKey,
          lastIncrement: last ? new Date(Number(last)).toISOString() : 'never',
          timeSinceLast: timeSinceLast ? `${(timeSinceLast / 1000 / 60).toFixed(1)} min ago` : 'never',
          cooldownRemaining: cooldownRemaining > 0 ? `${(cooldownRemaining / 1000 / 60).toFixed(1)} min remaining` : 'expired',
        })

        if (last && timeSinceLast < COOLDOWN_MS) {
          console.log(`[GlobalAudioPlayer] ⏳ Skipping: cooldown active (${(cooldownRemaining / 1000 / 60).toFixed(1)} min remaining)`)
          return
        }
      } catch (err) {
        console.warn('[GlobalAudioPlayer] sessionStorage check failed:', err)
      }

      // Clear any existing timer
      if (timerRef.current) {
        console.log('[GlobalAudioPlayer] Clearing existing timer')
        clearTimeout(timerRef.current)
      }

      console.log(`[GlobalAudioPlayer] ⏱️ Setting new timer for ${THRESHOLD_MS / 1000} seconds`)
      timerRef.current = setTimeout(async () => {
        console.log('[GlobalAudioPlayer] 5-second threshold reached for track:', track.id)
        try {
          console.log('[GlobalAudioPlayer] Calling incrementPlayCount for track:', track.id)
          await incrementPlayCount(track.id)
          console.log('[GlobalAudioPlayer] ✅ incrementPlayCount succeeded')

          // Mark as incremented in sessionStorage
          try {
            const now = Date.now()
            sessionStorage.setItem(sessionKey, String(now))
            console.log('[GlobalAudioPlayer] 📌 Stored cooldown marker:', {
              key: sessionKey,
              timestamp: new Date(now).toISOString(),
              cooldownUntil: new Date(now + COOLDOWN_MS).toISOString(),
            })
          } catch (err) {
            console.warn('[GlobalAudioPlayer] Could not store cooldown marker:', err)
          }
        } catch (err) {
          // Non-blocking failure; optionally report to analytics
          console.error('[GlobalAudioPlayer] ❌ Failed to increment play count:', err)
        }
      }, THRESHOLD_MS)
    }

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    // Start timer on play, clear it on pause/seek/ended
    audio.addEventListener('play', startTimer)
    audio.addEventListener('playing', startTimer)
    audio.addEventListener('pause', clearTimer)
    audio.addEventListener('seeking', clearTimer)
    audio.addEventListener('ended', clearTimer)
    audio.addEventListener('stalled', clearTimer)

    return () => {
      clearTimer()
      audio.removeEventListener('play', startTimer)
      audio.removeEventListener('playing', startTimer)
      audio.removeEventListener('pause', clearTimer)
      audio.removeEventListener('seeking', clearTimer)
      audio.removeEventListener('ended', clearTimer)
      audio.removeEventListener('stalled', clearTimer)
    }
  }, [track?.id, incrementPlayCount, session?.user?.id])

  if (!track) return null

  const coverSrc = track.image_path ? getPublicStorageUrl('track-images', track.image_path) : null
  const fallbackCover =
    track.cover_url ||
    track.profiles?.avatar_url ||
    track.avatar_url ||
    '/default-avatar.png'
  const imageSrc = coverSrc || fallbackCover

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 border-t border-gray-800 text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <img
          src={imageSrc}
          alt={track.title || 'Now playing'}
          className="h-12 w-12 rounded object-cover"
          onError={(e) => {
            e.target.src = '/default-avatar.png'
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{track.title || 'Untitled track'}</div>
          <div className="truncate text-xs text-gray-400">
            {track.artist || 'Unknown artist'}
            {track.album ? ` • ${track.album}` : ''}
          </div>
          {loading && <div className="text-[11px] text-teal-300">Loading audio…</div>}
          {!loading && error && <div className="text-[11px] text-red-400">{error}</div>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={isPlaying ? pause : resume}
            className="rounded-full bg-teal-500 px-3 py-1 text-sm font-semibold text-black hover:bg-teal-400 disabled:opacity-60"
            disabled={loading}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-full border border-gray-600 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}

export default App