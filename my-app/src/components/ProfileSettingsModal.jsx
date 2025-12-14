import UserProfile from './UserProfile'
import GdprExportPanel from './GdprExportPanel'

export default function ProfileSettingsModal({ open, session, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="w-full max-w-lg mx-4 space-y-4">
        <UserProfile
          session={session}
          isModal
          onClose={onClose}
        />
        <GdprExportPanel session={session} />
      </div>
    </div>
  )
}
