import { useState, useEffect } from 'react'
import { supabase, getPublicStorageUrl } from '../supabaseclient'
import imageCompression from 'browser-image-compression'
import NavBar from '../components/NavBar'
import AddToPlaylist from '../components/AddToPlaylist'

//This code allows users to upload audio tracks and manage them.

const sanitizeFileName = (name) => {
  if (!name) return `file-${Date.now()}`
  return name.replace(/[^a-z0-9.\-_]/gi, '').replace(/\s+/g, '-').toLowerCase()
}

export default function Upload({ session, player }) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [genreId, setGenreId] = useState(null)
  const [album, setAlbum] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [file, setFile] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [genres, setGenres] = useState([])
  const [loadingGenres, setLoadingGenres] = useState(false)
  const [imageProcessingTrackId, setImageProcessingTrackId] = useState(null)
  
  // Fetch user's tracks and genres
  useEffect(() => {
    if (session) {
      fetchUserTracks()
      fetchGenres()
    }
  }, [session])
  
  useEffect(() => {
    if (!session?.user?.id) return
    const loadAvatar = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single()
      if (!error) setProfileAvatarUrl(data?.avatar_url || null)
    }
    loadAvatar()
  }, [session?.user?.id])
  
  const fetchGenres = async () => {
    setLoadingGenres(true)
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('id, name, description')
        .order('name', { ascending: true })
      
      if (error) {
        console.error('Error fetching genres:', error)
        setError(`Error loading genres: ${error.message}`)
      } else {
        console.log('Genres fetched successfully:', data)
        setGenres(data || [])
      }
    } catch (err) {
      console.error('Exception when fetching genres:', err)
      setError(`Failed to load genres: ${err.message}`)
    } finally {
      setLoadingGenres(false)
    }
  }
  
  const fetchUserTracks = async () => {
    setLoadingTracks(true)
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select(`
          *,
          genres(
            name,
            description
          )
        `)
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching tracks:', error)
        setError(`Error loading tracks: ${error.message}`)
      } else {
        console.log('Tracks fetched successfully:', data)
        setTracks(data || [])
      }
    } catch (err) {
      console.error('Exception when fetching tracks:', err)
      setError(`Failed to load tracks: ${err.message}`)
    } finally {
      setLoadingTracks(false)
    }
  }
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    console.log('isFile', selectedFile instanceof File)
    setFile(selectedFile)
  }
  
  const handleImageChange = (e) => {
    const selectedImage = e.target.files[0]
    setImageFile(selectedImage || null)
  }

  const handleGenreSelect = (id) => {
    setGenreId(id === genreId ? null : id) // Toggle selection
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file) {
      setError('Please select an audio file to upload')
      return
    }
    
    if (!imageFile) {
      setError('Please select a cover image to upload')
      return
    }
    
    if (!title || !artist) {
      setError('Title and artist are required')
      return
    }
    
    if (!genreId) {
      setError('Please select a genre for your track')
      return
    }
    
    // Verify user is authenticated
    console.log('User ID:', session?.user?.id)
    if (!session?.user?.id) {
      setError('Authentication required')
      return
    }
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`
      const filePath = `${session.user.id}/${fileName}`
      
      console.log('Uploading file:', { filePath, fileType: file.type, fileSize: file.size })
      
      // 2. Upload audio file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, file, { upsert: true })
      
      console.log('Upload response:', { uploadData, uploadError })
      
      if (uploadError) {
        throw new Error(`Upload error: ${uploadError.message}`)
      }
      
      // Compress cover image before upload to avoid server-side size limits (5MB)
      const compressOptions = {
        maxSizeMB: 1, // target ~1MB (adjust as needed)
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8,
      }
      let compressedBlob
      try {
        compressedBlob = await imageCompression(imageFile, compressOptions)
      } catch (compErr) {
        console.warn('Image compression failed, falling back to original image', compErr)
        compressedBlob = imageFile
      }

      // Ensure compressed result is a File with the original filename
      const compressedFile = new File(
        [compressedBlob],
        `${Date.now()}-${sanitizeFileName(imageFile.name)}`,
        { type: compressedBlob.type || imageFile.type }
      )

      if (compressedFile.size > 5 * 1024 * 1024) {
        throw new Error('Cover image is too large even after compression. Please choose a smaller image (<5MB).')
      }

      const imageFileName = `${Date.now()}-${sanitizeFileName(imageFile.name)}`
      const imagePath = `${session.user.id}/tracks/${imageFileName}`

      // Upload compressed track image
      const { data: imageUploadData, error: imageUploadError } = await supabase.storage
        .from('track-images')
        .upload(imagePath, compressedFile, { upsert: true, contentType: compressedFile.type })

      if (imageUploadError) {
        throw new Error(`Image upload error: ${imageUploadError.message}`)
      }

      // 3. Create a record in the tracks table with the path only
      const trackData = {
        user_id: session.user.id,
        title,
        artist,
        genre_id: genreId, // Use the selected genre ID
        album,
        audio_path: filePath,
        mime_type: file.type,
        file_size: file.size,
        is_public: isPublic,
        image_path: imageUploadData?.path || imagePath
      }
      
      console.log('Inserting track data:', trackData)
      
      const { error: insertError } = await supabase
        .from('tracks')
        .insert(trackData)
      
      if (insertError) {
        throw new Error(`Database error: ${insertError.message}`)
      }
      
      // 4. Reset form and show success message
      setTitle('')
      setArtist('')
      setGenreId(null)
      setAlbum('')
      setFile(null)
      setImageFile(null)
      setSuccess('Track uploaded successfully!')
      
      // 5. Refresh tracks list
      fetchUserTracks()
      
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleTrackCoverUpload = async (trackId, existingPath, event) => {
    const coverFile = event.target.files?.[0]
    if (!coverFile) return
    if (!coverFile.type.startsWith('image/')) {
      setError('Cover must be an image file')
      event.target.value = ''
      return
    }
    setImageProcessingTrackId(trackId)
    setError(null)
    setSuccess(null)
    try {
      // Compress image before upload to respect the 5MB limit
      const compressOptions = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.8 }
      let compressedBlob
      try {
        compressedBlob = await imageCompression(coverFile, compressOptions)
      } catch (compErr) {
        console.warn('Image compression failed, using original cover', compErr)
        compressedBlob = coverFile
      }
      const compressedFile = new File(
        [compressedBlob],
        `${trackId}-${Date.now()}-${sanitizeFileName(coverFile.name)}`,
        { type: compressedBlob.type || coverFile.type }
      )
      if (compressedFile.size > 5 * 1024 * 1024) {
        throw new Error('Cover image is too large even after compression. Please choose a smaller image (<5MB).')
      }
      const imageFileName = `${trackId}-${Date.now()}-${sanitizeFileName(coverFile.name)}`
      const newImagePath = `${session.user.id}/tracks/${imageFileName}`
      const { data, error } = await supabase.storage
        .from('track-images')
        .upload(newImagePath, compressedFile, { upsert: true, contentType: compressedFile.type })
      if (error) throw new Error(`Image upload error: ${error.message}`)
      const finalPath = data?.path || newImagePath
      const { error: updateError } = await supabase
        .from('tracks')
        .update({ image_path: finalPath })
        .eq('id', trackId)
        .eq('user_id', session.user.id)
      if (updateError) throw new Error(`Database error: ${updateError.message}`)
      if (existingPath && existingPath !== finalPath) {
        await supabase.storage.from('track-images').remove([existingPath])
      }
      setSuccess('Track cover updated successfully!')
      fetchUserTracks()
    } catch (err) {
      setError(err.message)
    } finally {
      setImageProcessingTrackId(null)
      event.target.value = ''
    }
  }

  const handleRemoveTrackImage = async (trackId, existingPath) => {
    if (!existingPath) return
    setImageProcessingTrackId(trackId)
    setError(null)
    setSuccess(null)
    try {
      const { error: updateError } = await supabase
        .from('tracks')
        .update({ image_path: null })
        .eq('id', trackId)
        .eq('user_id', session.user.id)
      if (updateError) throw new Error(`Database error: ${updateError.message}`)
      const { error: removeError } = await supabase.storage
        .from('track-images')
        .remove([existingPath])
      if (removeError) console.error('Image removal warning:', removeError)
      setSuccess('Track cover removed.')
      fetchUserTracks()
    } catch (err) {
      setError(err.message)
    } finally {
      setImageProcessingTrackId(null)
    }
  }

  const handleDeleteTrack = async (trackId) => {
    if (!confirm('Are you sure you want to delete this track?')) {
      return
    }
    
    setLoading(true)
    
    // 1. Get the track details
    const { data: trackData, error: fetchError } = await supabase
      .from('tracks')
      .select('audio_path, image_path')
      .eq('id', trackId)
      .single()
    
    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }
    
    // 2. Soft-delete the record from the tracks table
    const { error: updateError } = await supabase
      .from('tracks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', trackId)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // 3. Skip physical storage removal for soft-deleted tracks
    // ...existing code removed...

    // 5. Refresh tracks list
    fetchUserTracks()
    setLoading(false)
    setSuccess('Track archived successfully!')
  }
  
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }
  
  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar session={session} onSignOut={handleSignOut} />
      <div className="max-w-4xl mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg text-white">
        <h2 className="text-2xl font-bold mb-6">Upload Track</h2>
        
        {error && <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-500 bg-opacity-25 text-green-100 p-3 rounded mb-4">{success}</div>}
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Artist *</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block mb-2">Genre *</label>
            {loadingGenres ? (
              <div className="p-2 rounded bg-gray-800 text-gray-400">Loading genres...</div>
            ) : genres.length === 0 ? (
              <div className="p-2 rounded bg-gray-800 text-gray-400">No genres available</div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded bg-gray-800">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => handleGenreSelect(genre.id)}
                    className={`px-3 py-1 rounded text-sm ${
                      genreId === genre.id
                        ? 'bg-teal-400 text-black'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                    title={genre.description}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            )}
            {!loadingGenres && genreId === null && (
              <p className="text-red-400 text-sm mt-1">Please select a genre</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block mb-1">Audio File *</label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="w-full p-2 rounded bg-gray-800 text-white"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">Cover Image *</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full p-2 rounded bg-gray-800 text-white"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mr-2"
              />
              Make this track public
            </label>
          </div>
          
          <button
            type="submit"
            className="bg-teal-400 text-white px-4 py-2 rounded font-bold hover:bg-teal-300"
            disabled={loading || genreId === null}
          >
            {loading ? 'Uploading...' : 'Upload Track'}
          </button>
        </form>
        
        <h2 className="text-2xl font-bold mb-4">Your Tracks</h2>
        
        {loadingTracks ? (
          <div>Loading your tracks...</div>
        ) : tracks.length === 0 ? (
          <div>You haven't uploaded any tracks yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tracks.map(track => {
              const coverSrc =
                getPublicStorageUrl('track-images', track.image_path) ||
                profileAvatarUrl ||
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
              return (
                <div key={track.id} className="bg-gray-800 p-4 rounded flex flex-col md:flex-row gap-4">
                  <img
                    src={coverSrc}
                    alt={`${track.title} cover`}
                    className="w-24 h-24 object-cover rounded"
                    onError={(e) => { e.target.src = profileAvatarUrl || '/default-avatar.png' }}
                  />
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 flex-1">
                    <div>
                      <h3 className="font-bold">{track.title}</h3>
                      <p>{track.artist} {track.album ? `• ${track.album}` : ''}</p>
                      <p className="text-sm text-gray-400">
                        {track.genres ? track.genres.name : 'No genre'} • {track.is_public ? 'Public' : 'Private'}
                        {track.mime_type && ` • ${track.mime_type.split('/')[1]}`}
                        {track.file_size && ` • ${Math.round(track.file_size / 1024)} KB`}
                      </p>
                      {!track.audio_path && <p className="text-red-400 text-sm">Audio path missing</p>}
                    </div>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:items-end">
                      <div className="flex gap-2 w-full md:w-auto">
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
                        <AddToPlaylist session={session} track={track} />
                        <button
                          onClick={() => handleDeleteTrack(track.id)}
                          className="bg-red-500 text-white p-1 rounded"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-col gap-2 w-full md:w-auto text-sm">
                        <input
                          id={`cover-upload-${track.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleTrackCoverUpload(track.id, track.image_path, event)}
                          disabled={imageProcessingTrackId === track.id}
                        />
                        <label
                          htmlFor={`cover-upload-${track.id}`}
                          className={`px-2 py-1 rounded text-center cursor-pointer ${
                            imageProcessingTrackId === track.id
                              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                              : 'bg-teal-500 text-black hover:bg-teal-400'
                          }`}
                        >
                          {track.image_path ? 'Change cover' : 'Add cover'}
                        </label>
                        {track.image_path && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTrackImage(track.id, track.image_path)}
                            className="bg-gray-700 text-white px-2 py-1 rounded disabled:opacity-50"
                            disabled={imageProcessingTrackId === track.id}
                          >
                            Remove cover
                          </button>
                        )}
                        {imageProcessingTrackId === track.id && (
                          <span className="text-xs text-gray-400">Updating cover...</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Button to refresh tracks if there was an error */}
        {error && !loading && (
          <button 
            onClick={() => fetchUserTracks()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Retry loading tracks
          </button>
        )}
      </div>
    </div>
  )
}