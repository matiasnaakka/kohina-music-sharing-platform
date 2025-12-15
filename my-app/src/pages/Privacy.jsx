import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-gray-300 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <section className="space-y-3 text-gray-200 leading-relaxed">
          <p>
            We collect account information you provide (email, username, profile details) and content you upload
            (tracks, images, comments, playlists). Playback and engagement data (likes, plays) may be recorded to
            operate core features. We do not sell your data.
          </p>
          <p>
            Your data is stored with Supabase. Access is restricted to your account except where you choose to make
            content public. You can delete content you own, and you may request account deletion at any time.
          </p>
          <p>
            We use cookies/local storage for authentication sessions and basic preferences (e.g., volume). Third-party
            logins follow the respective provider&apos;s terms.
          </p>
          <p>
            For questions or requests (access, correction, deletion), contact us at <a href="mailto:matias5230@gmail.com" className="text-teal-300 underline">matias5230@gmail.com</a>.
          </p>
        </section>

        <div className="flex gap-4 text-sm">
          <Link to="/" className="text-teal-300 hover:underline">Back to login</Link>
          <Link to="/home" className="text-gray-300 hover:underline">Go to app</Link>
        </div>
      </div>
    </div>
  )
}
