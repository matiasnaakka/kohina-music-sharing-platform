import './index.css'
import { useState, useEffect, useMemo } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseclient'
import Home from './pages/Home'
import ProtectedRoute from './components/protectedRoutes'
import LoginLayout from './components/LoginLayout'
import Profile from './pages/Profile'
import Upload from './pages/Upload'
import PasswordResetForm from './components/PasswordResetForm'
import Playlist from './pages/Playlist'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

// Scroll to top on route change for SPA navigation
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    // Use instant jump to avoid showing old scroll position on new route
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

const customAppearance = {
  theme: {
    ...ThemeSupa,
    colors: {
      bg: '#ffffff',
      brand: '#06b6d4',
      brandAccent: '#0ea5a4',
      defaultButtonText: '#ffffff',
      inputBackground: '#ffffff',
      inputText: '#0f172a',
      inputPlaceholder: '#6b7280',
      inputBorder: '#e5e7eb',
    },
  },
}

/*
  Routing.jsx
  - Checks Supabase auth state on mount.
  - Shows the Auth UI when no session is present, otherwise redirects to /home.
  - Exposes protected routes (Home, Profile, Upload) which rely on ProtectedRoute wrapper.
*/
const Routing = ({ player }) => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Cloudflare Pages friendly
  const redirectToHome = useMemo(() => `${window.location.origin}/home`, [])

  useEffect(() => {
    // Set loading state to true while we check for an existing session
    setLoading(true)
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Subscribe to auth state changes so UI updates on sign-in/out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!loading && !session) {
      player?.stop?.()
    }
  }, [loading, session, player])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Root route shows login when not authenticated, or redirects to /home */}
        <Route
          path="/"
          element={
            loading ? (
              <div>Loading...</div>
            ) : session ? (
              <Navigate to="/home" replace />
            ) : (
              <LoginLayout>
                <div className="space-y-4">
                  <Auth
                    supabaseClient={supabase}
                    appearance={customAppearance}
                    providers={['google']}
                    // Ensures external auth flows return into the SPA route on Cloudflare Pages
                    redirectTo={redirectToHome}
                  />
                  <div className="text-center text-sm text-gray-300">
                    <Link to="/privacy" className="hover:text-teal-300 underline">
                      Privacy Policy
                    </Link>
                    <span className="mx-2 text-gray-500">•</span>
                    <Link to="/terms" className="hover:text-teal-300 underline">
                      Terms of Service
                    </Link>
                  </div>
                </div>
              </LoginLayout>
            )
          }
        />

        {/* Password reset route - handles callback from email link */}
        <Route
          path="/reset-password"
          element={
            <PasswordResetForm
              // Avoid full reload; stay within HashRouter
              onResetComplete={() => {
                window.location.replace('/home')
              }}
            />
          }
        />

        {/* Protected pages */}
        <Route
          path="/home"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <Home session={session} player={player} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <Profile session={session} player={player} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <Upload session={session} player={player} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/playlist"
          element={
            <ProtectedRoute session={session} loading={loading}>
              <Playlist session={session} player={player} />
            </ProtectedRoute>
          }
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </BrowserRouter>
  )
}

export default Routing