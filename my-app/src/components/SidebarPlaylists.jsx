import { Link } from 'react-router-dom'

export default function SidebarPlaylists({ title = 'Public playlists', playlists, loading, error }) {
  return (
    <aside className="bg-gray-900 bg-opacity-80 p-4 rounded">
      <h4 className="text-xl font-semibold mb-3">{title}</h4>
      {loading ? (
        <div className="text-gray-400 text-sm">Loading playlists...</div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : !playlists || playlists.length === 0 ? (
        <div className="text-gray-400 text-sm">No public playlists yet.</div>
      ) : (
        <ul className="space-y-3 text-sm">
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <Link
                to={`/playlist?id=${playlist.id}`}
                className="block bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded transition"
              >
                <p className="text-white font-semibold">{playlist.title}</p>
                {playlist.description && (
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{playlist.description}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Updated {new Date(playlist.updated_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
