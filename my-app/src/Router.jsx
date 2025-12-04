import './index.css'
import { useState, useEffect } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseclient'
import Home from './pages/Home'
import ProtectedRoute from './components/protectedRoutes'
import LoginLayout from './components/LoginLayout'
import Profile from './pages/Profile'
import Upload from './pages/Upload'
import PasswordResetForm from './components/PasswordResetForm'

/*
  Routing.jsx
  - Checks Supabase auth state on mount.
  - Shows the Auth UI when no session is present, otherwise redirects to /home.
  - Exposes protected routes (Home, Profile, Upload) which rely on ProtectedRoute wrapper.
*/
const Routing = ({ player }) => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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
                <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} redirectTo={`${window.location.origin}/reset-password`} />
                
              </LoginLayout>
            )
          }
        />

        {/* Password reset route - handles callback from email link */}
        <Route
          path="/reset-password"
          element={
            <PasswordResetForm
              onResetComplete={() => {
                // Redirect to home or login after successful reset
                window.location.href = '/home'
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
      </Routes>
    </BrowserRouter>
  )
}

export default Routing