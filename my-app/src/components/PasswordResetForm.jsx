import { useState, useEffect } from 'react'
import { supabase } from '../supabaseclient'
import LoginLayout from './LoginLayout'

const PasswordResetForm = ({ onResetComplete }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event when user clicks reset link
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setError(null)
      }
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validate passwords
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      setSuccess('Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')

      // Redirect after successful reset
      if (onResetComplete) {
        setTimeout(() => {
          onResetComplete()
        }, 2000)
      }
    } catch (err) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginLayout>
      <div className="bg-gray-900 rounded-lg p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Set New Password</h2>
        <p className="text-gray-400 text-sm mb-6">Enter your new password below.</p>

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-300 mb-1 block">New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="••••••••"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-300 mb-1 block">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="••••••••"
              required
            />
          </label>

          <button
            type="submit"
            className="w-full bg-teal-400 text-black px-4 py-2 rounded font-bold hover:bg-teal-300 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </LoginLayout>
  )
}

export default PasswordResetForm
