import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-gray-300 text-sm">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <section className="space-y-3 text-gray-200 leading-relaxed">
          <p>
            By using Kohina you agree to these terms. You must only upload content you have rights to share, and you
            remain responsible for your uploads, comments, and playlists. Do not upload illegal, infringing, or harmful content.
          </p>
          <p>
            We may remove content or suspend accounts that violate these terms or applicable law. Service availability
            is provided &ldquo;as is&rdquo;; we may change features at any time.
          </p>
          <p>
            Data is stored with Supabase. Please review our Privacy Policy for how we handle personal data. For
            questions, contact <a href="mailto:matias5230@gmail.com" className="text-teal-300 underline">matias5230@gmail.com</a>.
          </p>
        </section>

        <div className="flex gap-4 text-sm">
          <Link to="/" className="text-teal-300 hover:underline">Back to login</Link>
          <Link to="/privacy" className="text-gray-300 hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
