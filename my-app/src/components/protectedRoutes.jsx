// ProtectedRoutes component
// - Wraps routes that require an authenticated session.
// - Shows a loading indicator while auth state is being determined, otherwise redirects to "/".
import { Navigate, useLocation } from 'react-router-dom'

export default function ProtectedRoutes({ session, children, loading }) {
  const location = useLocation()

  // Show loading indicator while checking authentication
  if (loading) {
    return <div>Loading authentication...</div>
  }
  
  // Only redirect if we're sure there's no session
  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />
  }
  
  return children
}