import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseclient'
import imageCompression from 'browser-image-compression'
import PasswordResetRequest from './PasswordResetRequest'

const UserProfile = ({ session, isModal = false, onClose, readOnly = false }) => {
  const [profile, setProfile] = useState({
    username: '',
    bio: '',
    location: '',
    avatar_url: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [avatarKey, setAvatarKey] = useState(Date.now())
  const [deleting, setDeleting] = useState(false)
  const [followingCount, setFollowingCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, bio, location, avatar_url')
          .eq('id', session.user.id)
          .single()
        if (profileError) throw profileError
        setProfile(profileData || {
          username: '',
          bio: '',
          location: '',
          avatar_url: ''
        })

        const { count = 0, error: followingError } = await supabase
          .from('followers')
          .select('followed_id', { count: 'exact', head: true })
          .eq('follower_id', session.user.id)
        if (followingError) throw followingError
        setFollowingCount(count)

        const { count: followerTotal = 0, error: followerError } = await supabase
          .from('followers')
          .select('follower_id', { count: 'exact', head: true })
          .eq('followed_id', session.user.id)
        if (followerError) throw followerError
        setFollowerCount(followerTotal)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (session) fetchProfile()
  }, [session])

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Clear previous messages
    setError(null)
    setSuccess(null)
    setLoading(true)
    
    try {
      // If file is large, compress it (or attempt compression for all images to reduce size)
      const MAX_MB = 5
      const compressOptions = {
        maxSizeMB: 1, // target size (adjust as needed)
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8,
      }

      let toUploadBlob = file
      try {
        // Attempt compression — imageCompression will return a Blob
        const compressed = await imageCompression(file, compressOptions)
        // Use compressed result if smaller
        if (compressed && compressed.size > 0 && compressed.size < file.size) {
          toUploadBlob = compressed
        }
      } catch (compErr) {
        console.warn('Avatar compression failed, using original file', compErr)
        toUploadBlob = file
      }

      // Ensure upload is a File and has a sensible name/type
      const ext = (file.name && file.name.split('.').pop()) || 'png'
      const timestamp = Date.now()
      const uploadFile = new File(
        [toUploadBlob],
        `avatar-${timestamp}.${ext}`,
        { type: toUploadBlob.type || file.type }
      )

      if (uploadFile.size > MAX_MB * 1024 * 1024) {
        throw new Error(`Avatar image is too large even after compression. Please choose an image under ${MAX_MB}MB.`)
      }

      // Use a stable storage path
      const path = `${session.user.id}/avatar-${timestamp}.${ext}`
      
      console.log('Uploading avatar...', uploadFile.name, 'size', uploadFile.size)
      
      // Upload avatar to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, uploadFile, { upsert: true, contentType: uploadFile.type })
        
      if (uploadError) {
        throw new Error(`Upload error: ${uploadError.message}`)
      }
      
      // Get the public URL and update DB
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)
      
      const avatarUrl = `${urlData.publicUrl}?t=${timestamp}`
      
      // Persist to database immediately
      const updates = { 
        id: session.user.id,
        username: profile.username || 'user_' + session.user.id.substring(0, 8), // Ensure username is not null
        avatar_url: urlData.publicUrl, // Store the clean URL in the database
        updated_at: new Date() 
      }
      
      // Update the profile in the database
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: ['id'] })
        
      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }
      
      // Force image refresh by updating the key
      setAvatarKey(timestamp)
      
      // Update local state with the cache-busted URL
      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }))
      
      // Set success message
      setSuccess('Avatar updated successfully!')
      
      console.log('Avatar update complete!')
    } catch (err) {
      console.error('Avatar update failed:', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Clear previous messages
    setError(null)
    setSuccess(null)
    setLoading(true)
    
    try {
      const updates = {
        ...profile,
        id: session.user.id,
        updated_at: new Date()
      }
      
      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: ['id'] })
      
      if (error) {
        throw new Error(error.message)
      }
      
      setSuccess('Profile updated successfully!')
    } catch (err) {
      console.error('Profile update error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Delete profile handler: invokes edge/function 'delete-account' and signs the user out on success
  const handleDeleteProfile = async () => {
    if (!session?.user?.id) return

    const confirmed = window.confirm(
      'This will immediately delete your account and all your data. This cannot be undone. Are you sure?'
    )
    if (!confirmed) return

    setError(null)
    setSuccess(null)
    setDeleting(true)

    try {
      // Do NOT send user_id in the body. The Edge Function reads the user id from the JWT.
      const { error: fnError } = await supabase.functions.invoke('delete-account', {
        body: {} // body is optional; can also omit this entirely
      })

      if (fnError) {
        throw fnError
      }

      setSuccess('Your account has been scheduled for deletion.')

      try {
        await supabase.auth.signOut()
      } catch (signOutErr) {
        console.error('Sign out after delete failed:', signOutErr)
      }

      if (onClose) onClose()
      navigate('/')
    } catch (err) {
      console.error('Delete profile error:', err)
      setError(err?.message || 'Failed to delete profile.')
    } finally {
      setDeleting(false)
    }
  }

  if (!session) return <div>Please log in to view your profile.</div>
  if (loading && !profile.username) return <div>Loading...</div>

  const containerClasses = isModal
    ? 'p-6 bg-gray-900 rounded-lg text-white shadow-xl relative'
    : 'max-w-md mx-auto mt-16 p-6 bg-black bg-opacity-80 rounded-lg text-white'

  // Read-only display (no editing inline)
  if (readOnly) {
    return (
      <div className={containerClasses}>
        <h2 className="text-2xl font-bold mb-2">Profile</h2>
        <p className="text-sm text-gray-300 mb-4">
          Following {followingCount} • Followers {followerCount}
        </p>

        {error && (
          <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center mb-4">
          <img
            key={avatarKey}
            src={profile.avatar_url ? `${profile.avatar_url}?t=${avatarKey}` : '/default-avatar.png'}
            alt="Avatar"
            className="w-24 h-24 mb-3 object-cover"
            onError={(e) => { e.target.src = '/default-avatar.png' }}
          />
          <div className="w-full">
            <div className="mb-2">
              <div className="text-xs uppercase text-gray-400">Username</div>
              <div className="text-white">{profile.username || '—'}</div>
            </div>
            <div className="mb-2">
              <div className="text-xs uppercase text-gray-400">Bio</div>
              <div className="text-gray-200 whitespace-pre-line">{profile.bio || 'No bio yet.'}</div>
            </div>
            <div className="mb-2">
              <div className="text-xs uppercase text-gray-400">Location</div>
              <div className="text-white">{profile.location || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Editable (used in modal via Settings)
  return (
    <div className={containerClasses}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-300 hover:text-white"
          aria-label="Close settings"
        >
          ✕
        </button>
      )}

      <h2 className="text-2xl font-bold mb-2">Profile</h2>
      <p className="text-sm text-gray-300 mb-4">
        Following {followingCount} • Followers {followerCount}
      </p>

      {error && (
        <div className="bg-red-500 bg-opacity-25 text-red-100 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500 bg-opacity-25 text-green-100 p-3 rounded mb-4">
          {success}
        </div>
      )}

      {showPasswordReset ? (
        <PasswordResetRequest onClose={() => setShowPasswordReset(false)} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col items-center">
            <img
              key={avatarKey}
              src={profile.avatar_url ? `${profile.avatar_url}?t=${avatarKey}` : '/default-avatar.png'}
              alt="Avatar"
              className="w-24 h-24 mb-2 object-cover"
              onError={(e) => { e.target.src = '/default-avatar.png' }}
            />
            <div className="flex flex-col items-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="text-white"
                id="avatar-upload"
              />
              {loading && <p className="text-sm text-gray-400 mt-1">Uploading...</p>}
            </div>
          </div>

          <label>
            Username
            <input
              type="text"
              name="username"
              value={profile.username ?? ''}
              onChange={handleChange}
              className="w-full p-2 rounded text-white"
              required
            />
          </label>
          <label>
            Bio
            <textarea
              name="bio"
              value={profile.bio ?? ''}
              onChange={handleChange}
              className="w-full p-2 rounded text-white"
              rows={3}
            />
          </label>
          <label>
            Location
            <input
              type="text"
              name="location"
              value={profile.location ?? ''}
              onChange={handleChange}
              className="w-full p-2 rounded text-white"
            />
          </label>
          <button
            type="submit"
            className="bg-teal-400 text-white px-4 py-2 rounded font-bold hover:bg-teal-300"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Update Profile'}
          </button>

          {/* Password reset section */}
          <div className="pt-2 border-t border-gray-800 mt-2">
            <p className="text-xs text-gray-400 mb-2">
              Reset your account password. We'll send a confirmation link to your email.
            </p>
            <button
              type="button"
              onClick={() => setShowPasswordReset(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-500 w-full mb-2"
            >
              Change Password
            </button>
          </div>

          {/* Delete profile action */}
          <div className="pt-2 border-t border-gray-800 mt-2">
            <p className="text-xs text-gray-400 mb-2">
              Delete your account. It will be marked for deletion now and permanently removed after 30 days.
            </p>
            <button
              type="button"
              onClick={handleDeleteProfile}
              className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-500 disabled:opacity-60 w-full"
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default UserProfile
