import { useState } from 'react'
import { supabase } from '../supabaseclient'

const PasswordResetRequest = ({ onClose }) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (!email) {
        throw new Error('Please enter your email address')
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      setSuccess('Password reset email sent! Check your inbox for instructions.')
      setEmail('')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 text-white shadow-xl">
      <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
      
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
          <span className="text-sm font-medium text-gray-300 mb-1 block">Email Address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="your@email.com"
            required
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-teal-400 text-black px-4 py-2 rounded font-bold hover:bg-teal-300 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Email'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default PasswordResetRequest
