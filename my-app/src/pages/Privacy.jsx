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
            We use cookies/local storage for authentication sessions and basic preferences (e.g., volume). Third-party authentication providers, such as Google, are used in accordance with this Privacy Policy and the provider’s terms.
          </p>
          <p>
            For questions or requests (access, correction, deletion), contact us at <a href="mailto:matias5230@gmail.com" className="text-teal-300 underline">matias5230@gmail.com</a>.
          </p>
        </section>

        <section className="space-y-3 text-gray-200 leading-relaxed">
          <h2 className="text-xl font-semibold text-white">Google Authentication</h2>
          <p>
            Kohina allows users to authenticate using Google Sign-In. When you choose this option, we receive limited
            information from Google, including your primary email address, display name, and profile image. This
            information is used solely to authenticate your account and associate it with a Kohina user profile. We do
            not access your Google password or any other Google services.
          </p>
          <h2 className="text-xl font-semibold text-white">Data Processing and Storage</h2>
          <p>
            Authentication data and account information obtained through Google Sign-In is processed and stored using
            Supabase, which acts as our authentication and database service provider. Supabase processes this data on
            our behalf and in accordance with our instructions to operate and secure the Kohina service.
          </p>
          <h2 className="text-xl font-semibold text-white">Data Sharing</h2>
          <p>
            We do not sell or share Google user data with third parties. Access to this data is limited to Kohina and
            our service providers strictly for the purpose of operating the application.
          </p>
        </section>

        <div className="flex gap-4 text-sm">
          <Link to="/authentication" className="text-teal-300 hover:underline">Back to login</Link>
          <Link to="/home" className="text-gray-300 hover:underline">Go to app</Link>
        </div>
      </div>
    </div>
  )
}
