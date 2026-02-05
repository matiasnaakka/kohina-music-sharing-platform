import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseclient'

export default function usePlaylist(playlistId, userId) {
  const [playlist, setPlaylist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [likeCounts, setLikeCounts] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPlaylist = useCallback(async () => {
    if (!playlistId) {
      setError('Playlist ID not provided')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('id, title, description, owner, is_public, created_at, updated_at')
        .eq('id', playlistId)
        .single()

      if (playlistError) throw playlistError
      if (!playlistData) throw new Error('Playlist not found')

      const ownerCheck = userId === playlistData.owner
      setIsOwner(ownerCheck)

      if (!playlistData.is_public && !ownerCheck) {
        throw new Error('This playlist is private')
      }

      setPlaylist(playlistData)

      const { data: tracksData, error: tracksError } = await supabase
        .from('playlist_tracks')
        .select(`
          id,
          track_id,
          created_at,
          tracks (
            id,
            title,
            artist,
            album,
            audio_path,
            image_path,
            user_id,
            created_at,
            play_count,
            genres(name),
            profiles!tracks_user_id_fkey(username, avatar_url)
          )
        `)
        .eq('playlist_id', playlistId)
        .order('created_at', { ascending: false })

      if (tracksError) throw tracksError

      const mappedTracks = (tracksData || [])
        .filter((pt) => pt.tracks)
        .map((pt) => ({
          ...pt.tracks,
          playlistTrackId: pt.id,
          addedAt: pt.created_at,
        }))

      setTracks(mappedTracks)

      const ids = mappedTracks.map((t) => t.id).filter(Boolean)
      if (ids.length) {
        try {
          const { data: likesRows, error: likesErr } = await supabase
            .from('track_likes')
            .select('track_id')
            .in('track_id', ids)

          if (likesErr) throw likesErr

          const counts = new Map()
          for (const row of likesRows || []) {
            const tid = row.track_id
            counts.set(tid, (counts.get(tid) || 0) + 1)
          }
          setLikeCounts(counts)
        } catch (likesError) {
          console.warn('Failed to load like counts for playlist tracks:', likesError)
          setLikeCounts(new Map())
        }
      } else {
        setLikeCounts(new Map())
      }
    } catch (err) {
      console.error('Error fetching playlist:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [playlistId, userId])

  useEffect(() => {
    fetchPlaylist()
  }, [fetchPlaylist])

  const removeTrack = useCallback(
    async (playlistTrackId) => {
      if (!isOwner) throw new Error('Not authorized')
      setRemoving(playlistTrackId)
      try {
        const { error } = await supabase.from('playlist_tracks').delete().eq('id', playlistTrackId)
        if (error) throw error
        setTracks((prev) => prev.filter((t) => t.playlistTrackId !== playlistTrackId))
      } catch (err) {
        setError(err.message || 'Failed to remove track')
        throw err
      } finally {
        setRemoving(null)
      }
    },
    [isOwner],
  )

  const deletePlaylist = useCallback(async () => {
    if (!isOwner) throw new Error('Not authorized')
    if (!playlistId) throw new Error('Playlist ID missing')
    setDeleting(true)
    try {
      const { error: ptError } = await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId)
      if (ptError) throw ptError

      const { error: delError } = await supabase.from('playlists').delete().eq('id', playlistId)
      if (delError) throw delError

      return true
    } catch (err) {
      console.error('Failed to delete playlist:', err)
      setError(err.message || 'Failed to delete playlist')
      throw err
    } finally {
      setDeleting(false)
    }
  }, [isOwner, playlistId])

  return {
    playlist,
    tracks,
    likeCounts,
    loading,
    error,
    isOwner,
    removing,
    deleting,
    fetchPlaylist,
    removeTrack,
    deletePlaylist,
  }
}
