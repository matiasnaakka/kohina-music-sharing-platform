// ProtectedRoutes component
// - Wraps routes that require an authenticated session.
// - Shows a loading indicator while auth state is being determined, otherwise redirects to "/".
import { Navigate } from 'react-router-dom'

export default function ProtectedRoutes({ session, children, loading }) {
  // Show loading indicator while checking authentication
  if (loading) {
    return <div>Loading authentication...</div>
  }
  
  // Only redirect if we're sure there's no session
  if (!session) {
    return <Navigate to="/" replace />
  }
  
  return children
}