import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import Routing from './Router'
import { supabase, getPublicStorageUrl, SUPABASE_URL } from './supabaseclient'
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
  const [volume, setVolume] = useState(0.8) // default 80%
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)

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
  const playTrack = useCallback(async (track, queueList = []) => {
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

    // Build/remember queue
    const normalized = Array.isArray(queueList) ? queueList.filter((t) => t?.id) : []
    const baseQueue = normalized.length ? normalized : [track]
    let idx = baseQueue.findIndex((t) => t.id === track.id)
    const finalQueue = [...baseQueue]
    if (idx < 0) {
      finalQueue.push(track)
      idx = finalQueue.length - 1
    }
    setQueue(finalQueue)
    setQueueIndex(idx)

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
    setQueue([])
    setQueueIndex(0)
    setPlayerState(initialPlayerState)
  }, [])

  const nextTrack = useCallback(() => {
    if (!queue.length) return
    const nextIdx = (queueIndex + 1) % queue.length
    playTrack(queue[nextIdx], queue)
  }, [queue, queueIndex, playTrack])

  const prevTrack = useCallback(() => {
    if (!queue.length) return
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length
    playTrack(queue[prevIdx], queue)
  }, [queue, queueIndex, playTrack])

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
      next: nextTrack,
      previous: prevTrack,
      queueLength: queue.length,
    }),
    [playerState, playTrack, pause, resume, stop, nextTrack, prevTrack, queue.length],
  )

  // Add basic SEO/meta and connection hints
  useEffect(() => {
    try {
      // Meta description
      const desc = 'Kohina – upload, discover, like and share music tracks.'
      let meta = document.querySelector('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      if (!meta.getAttribute('content')) {
        meta.setAttribute('content', desc)
      }

      // Preconnect/DNS-prefetch to Supabase origin
      if (SUPABASE_URL) {
        const origin = new URL(SUPABASE_URL).origin
        const ensureLink = (rel) => {
          const sel = `link[rel="${rel}"][href="${origin}"]`
          if (!document.head.querySelector(sel)) {
            const link = document.createElement('link')
            link.rel = rel
            link.href = origin
            document.head.appendChild(link)
          }
        }
        ensureLink('preconnect')
        ensureLink('dns-prefetch')
      }

      // PWA meta
      const ensureMeta = (name, content) => {
        let m = document.querySelector(`meta[name="${name}"]`)
        if (!m) {
          m = document.createElement('meta')
          m.name = name
          document.head.appendChild(m)
        }
        m.setAttribute('content', content)
      }
      ensureMeta('theme-color', '#14b8a6')
      ensureMeta('apple-mobile-web-app-capable', 'yes')
      ensureMeta('apple-mobile-web-app-status-bar-style', 'black')

      // Register Service Worker via Blob (no new file needed)
      if ('serviceWorker' in navigator && import.meta.env.PROD) {
        const CACHE_VERSION = 'v1'
        const swCode = `
          const VERSION = '${CACHE_VERSION}'
          const CORE_CACHE = 'core-' + VERSION
          const RUNTIME_CACHE = 'runtime-' + VERSION

          // Only cache real build assets here (SPA routes like /home are not real files)
          const CORE_ASSETS = [
            '/',
            '/index.html',
            '/default-avatar.png'
          ]

          self.addEventListener('install', (event) => {
            event.waitUntil(
              caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
            )
          })

          self.addEventListener('activate', (event) => {
            event.waitUntil(
              caches.keys().then((keys) =>
                Promise.all(keys.map((key) => {
                  if (!key.includes(VERSION)) return caches.delete(key)
                }))
              ).then(() => self.clients.claim())
            )
          })

          // Network-first for navigation; cache-first for static; stale-while-revalidate for runtime
          self.addEventListener('fetch', (event) => {
            const req = event.request
            const url = new URL(req.url)

            // Handle navigation requests (SPA) with network-first and fallback to cache
            if (req.mode === 'navigate') {
              event.respondWith(
                fetch(req).catch(() => caches.match('/index.html'))
              )
              return
            }

            // Cache-first for images and static assets
            if (req.destination === 'image' || req.destination === 'style' || req.destination === 'script' || req.destination === 'font') {
              event.respondWith(
                caches.match(req).then((cached) => {
                  if (cached) return cached
                  return fetch(req).then((resp) => {
                    const clone = resp.clone()
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone))
                    return resp
                  })
                })
              )
              return
            }

            // Supabase storage: stale-while-revalidate for audio/images
            if (url.pathname.includes('/storage/v1/object/public/')) {
              event.respondWith(
                caches.match(req).then((cached) => {
                  const fetchPromise = fetch(req).then((resp) => {
                    const clone = resp.clone()
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone))
                    return resp
                  }).catch(() => cached)
                  return cached || fetchPromise
                })
              )
              return
            }

            // Default: pass-through
          })
        `
        const swBlob = new Blob([swCode], { type: 'application/javascript' })
        const swUrl = URL.createObjectURL(swBlob)
        navigator.serviceWorker.register(swUrl).catch((err) => {
          console.warn('Service worker registration failed:', err)
        })
      }
    } catch {
      // no-op
    }
  }, [])

  // Responsive sizing for the profile settings modal
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'profile-settings-modal-responsive'
    style.textContent = `
      .profile-settings-modal {
        width: clamp(320px, 90vw, 560px);
        max-height: 86vh;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow: hidden;
        box-sizing: border-box;
      }
      .profile-settings-modal .modal-body {
        overflow-y: auto;
        max-height: calc(86vh - 24px);
        padding: 8px 4px 12px;
        box-sizing: border-box;
        scrollbar-gutter: stable;
      }
      .profile-settings-modal img {
        max-width: 160px;
        height: auto;
      }
      @media (max-width: 480px) {
        .profile-settings-modal {
          width: 94vw;
          max-height: 82vh;
          gap: 8px;
        }
        .profile-settings-modal .modal-body {
          padding: 6px 2px 10px;
        }
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

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
        volume={volume}
        setVolume={setVolume}
        onNext={nextTrack}
        onPrev={prevTrack}
        canNavigate={queue.length > 1}
      />
    </>
  )
}

// GlobalAudioPlayer component renders the bottom player UI
const GlobalAudioPlayer = ({
  audioRef,
  playerState,
  pause,
  resume,
  stop,
  session,
  volume,
  setVolume,
  onNext,
  onPrev,
  canNavigate,
}) => {
  const { track, isPlaying, loading, error } = playerState
  const { increment: incrementPlayCount } = useIncrementPlayCount()
  const timerRef = useRef(null)
  const canvasRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const dataArrayRef = useRef(null)
  const animationRef = useRef(null)
  const [progress, setProgress] = useState(0) // 0..1
  const [duration, setDuration] = useState(0)

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

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track?.id) return
    const onLoaded = () => {
      setDuration(audio.duration || 0)
    }
    const onTime = () => {
      const d = audio.duration || 0
      setDuration(d)
      setProgress(d ? audio.currentTime / d : 0)
    }
    const onEnded = () => {
      setProgress(0)
    }
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [track?.id])

  const handleSeek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    audio.currentTime = ratio * duration
    setProgress(ratio)
  }

  const handleVolume = (e) => {
    const next = Number(e.target.value)
    setVolume(next)
    const audio = audioRef.current
    if (audio) audio.volume = next
  }

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
      <div className="mx-auto relative flex max-w-5xl items-center gap-4 px-4 py-3">
        <img
          src={imageSrc}
          alt={track.title || 'Now playing'}
          className="h-12 w-12 rounded object-cover"
          width="48"
          height="48"
          decoding="async"
          loading="lazy"
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

        {/* Centered progress line, absolutely positioned */}
        <div className="pointer-events-none hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-10">
          <div className="flex flex-col items-center gap-1">
            <div
              className="relative w-full h-2 cursor-pointer"
              onClick={handleSeek}
              aria-label="Seek"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-gray-700" />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-teal-400 transition-[width] duration-150"
                style={{ width: `${(progress || 0) * 100}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-300 tabular-nums">
              {Number.isFinite(duration) && duration > 0
                ? `${Math.floor((progress * duration) / 60).toString().padStart(2, '0')}:${Math.floor((progress * duration) % 60).toString().padStart(2, '0')} / ${Math.floor(duration / 60).toString().padStart(2, '0')}:${Math.floor(duration % 60).toString().padStart(2, '0')}`
                : '00:00 / 00:00'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            🔊
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolume}
              className="w-24 accent-teal-400"
              aria-label="Volume"
            />
            <span className="w-8 tabular-nums text-[11px] text-gray-400">{Math.round(volume * 100)}%</span>
          </label>
          <button
            type="button"
            onClick={onPrev}
            className="rounded-full border border-gray-600 px-2 py-1 text-sm text-gray-200 hover:bg-gray-800"
            disabled={!canNavigate || loading}
          >
            ◀ Prev
          </button>
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
            onClick={onNext}
            className="rounded-full border border-gray-600 px-2 py-1 text-sm text-gray-200 hover:bg-gray-800"
            disabled={!canNavigate || loading}
          >
            Next ▶
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
      <audio ref={audioRef} className="hidden" preload="metadata" />
    </div>
  )
}

export default App