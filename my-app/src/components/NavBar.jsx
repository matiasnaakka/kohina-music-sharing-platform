import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseclient' // added import

const NavBar = ({ session, onSignOut }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null) // new state

  useEffect(() => {
    if (!session?.user?.id) {
      setAvatarUrl(null)
      return
    }
    let isMounted = true
    const loadAvatar = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', session.user.id)
          .single()
        if (!error && isMounted) {
          setAvatarUrl(data?.avatar_url || null)
        }
      } catch (err) {
        if (isMounted) setAvatarUrl(null)
      }
    }
    loadAvatar()
    return () => { isMounted = false }
  }, [session?.user?.id])

  const handleSignOutClick = (e) => {
    e.preventDefault()
    setShowLogoutConfirm(true)
  }

  const confirmSignOut = () => {
    onSignOut()
    setShowLogoutConfirm(false)
  }

  const cancelSignOut = () => {
    setShowLogoutConfirm(false)
  }

  return (
    <nav className="w-full flex items-center justify-between px-6 py-4 bg-black bg-opacity-80 fixed top-0 left-0 z-30">
      <Link to="/home" className="text-white font-['Lalezar'] text-2xl">Kohina</Link>
      <div className="flex-1 flex justify-center px-4">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search..."
          className="w-full max-w-md rounded-full px-4 py-2 bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      {session && (
        <div className="flex items-center gap-4">
          <Link to="/home" className="text-white hover:underline">
            Home
          </Link>
          <Link to="/profile" className="text-white hover:underline">
            Profile
          </Link>
          <Link to="/upload" className="text-white hover:underline">
            Manage uploads
          </Link>

          {/* Replaced email text with profile avatar */}
          <img
            src={avatarUrl || '/default-avatar.png'}
            alt={session.user.email || 'User avatar'}
            title={session.user.email}
            className="w-8 h-8 rounded-full object-cover border border-gray-700"
            onError={(e) => { e.target.src = '/default-avatar.png' }}
          />

          <button
            onClick={handleSignOutClick}
            className="bg-green-500 text-black px-3 py-1 rounded hover:bg-gray-200"
          >
            Sign out
          </button>

          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-black p-4 rounded-md shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Confirm Sign Out</h3>
                <p className="mb-4">Are you sure you want to sign out?</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelSignOut}
                    className="px-3 py-1 bg-red-500 text-white rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSignOut}
                    className="px-3 py-1 bg-green-500 text-white rounded"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}

export default NavBar

