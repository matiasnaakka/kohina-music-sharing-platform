export default function FollowModal({ open, type, loading, error, users, onClose, onSelectUser }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-gray-900 border border-gray-800 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-lg font-semibold">{type === 'followers' ? 'Followers' : 'Following'}</h3>
          <button type="button" onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : !users?.length ? (
            <div className="text-sm text-gray-400">No users found.</div>
          ) : (
            <ul className="max-h-96 overflow-y-auto space-y-2">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onSelectUser?.(u.id)}
                    className="w-full flex items-center gap-3 rounded bg-gray-800 hover:bg-gray-700 px-3 py-2 text-left"
                  >
                    <img
                      src={u.avatar_url || '/default-avatar.png'}
                      alt={u.username || 'User'}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                      width="40"
                      height="40"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.src = '/default-avatar.png'
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{u.username || 'Anonymous'}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
