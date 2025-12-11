import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseclient'

const NavBar = ({ session, onSignOut }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    setMobileMenuOpen(false)
  }

  const cancelSignOut = () => {
    setShowLogoutConfirm(false)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <nav className="w-full flex items-center justify-between px-4 sm:px-6 py-4 bg-black bg-opacity-80 fixed top-0 left-0 z-30">
      <Link to="/home" className="text-white font-['Lalezar'] text-xl sm:text-2xl shrink-0">Kohina</Link>
      
      {session && (
        <>
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-4">
            <Link to="/home" className="text-white hover:underline text-sm md:text-base">
              Home
            </Link>
            <Link to="/profile" className="text-white hover:underline text-sm md:text-base">
              Profile
            </Link>
            <Link to="/upload" className="text-white hover:underline text-sm md:text-base">
              Manage uploads
            </Link>

            {/* Profile avatar */}
            <img
              src={avatarUrl || '/default-avatar.png'}
              alt={session.user.email || 'User avatar'}
              title={session.user.email}
              className="w-8 h-8 rounded-full object-cover border border-gray-700"
              width="32"
              height="32"
              decoding="async"
              fetchpriority="high"
              loading="eager"
              onError={(e) => { e.target.src = '/default-avatar.png' }}
            />

            <button
              onClick={handleSignOutClick}
              className="bg-green-500 text-black px-3 py-1 rounded text-sm hover:bg-green-400 font-medium"
            >
              Sign out
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center gap-3">
            <img
              src={avatarUrl || '/default-avatar.png'}
              alt={session.user.email || 'User avatar'}
              title={session.user.email}
              className="w-7 h-7 rounded-full object-cover border border-gray-700"
              width="28"
              height="28"
              decoding="async"
              fetchpriority="high"
              loading="eager"
              onError={(e) => { e.target.src = '/default-avatar.png' }}
            />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white text-2xl hover:text-gray-300"
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-black bg-opacity-95 border-b border-gray-700 sm:hidden">
              <div className="flex flex-col gap-4 p-4">
                <Link
                  to="/home"
                  onClick={closeMobileMenu}
                  className="text-white hover:text-teal-300 text-base font-medium"
                >
                  Home
                </Link>
                <Link
                  to="/profile"
                  onClick={closeMobileMenu}
                  className="text-white hover:text-teal-300 text-base font-medium"
                >
                  Profile
                </Link>
                <Link
                  to="/upload"
                  onClick={closeMobileMenu}
                  className="text-white hover:text-teal-300 text-base font-medium"
                >
                  Manage uploads
                </Link>
                <button
                  onClick={handleSignOutClick}
                  className="bg-green-500 text-black px-4 py-2 rounded text-base font-medium hover:bg-green-400 w-full"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}

          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-black p-4 rounded-md shadow-lg mx-4">
                <h3 className="text-lg font-semibold mb-2">Confirm Sign Out</h3>
                <p className="mb-4">Are you sure you want to sign out?</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelSignOut}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSignOut}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </nav>
  )
}

export default NavBar

