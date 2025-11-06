import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import Routing from './Router'
import { supabase, getPublicStorageUrl } from './supabaseclient'

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
  const audioRef = useRef(null)

  /**
   * playTrack
   * - Given a track record, create a signed URL for the audio file and start playback.
   */
  const playTrack = useCallback(async (track) => {
    if (!track?.audio_path) {
      // Fixed typo: setPlayerState (previously setPlayesrState) to avoid reference errors
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
    }))
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio
      .play()
      .catch((err) =>
        setPlayerState((prev) => ({
          ...prev,
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
  }, [])

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
      />
    </>
  )
}

// GlobalAudioPlayer component renders the bottom player UI
const GlobalAudioPlayer = ({ audioRef, playerState, pause, resume, stop }) => {
  const { track, isPlaying, loading, error } = playerState
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