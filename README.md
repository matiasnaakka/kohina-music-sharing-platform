# Kohina — Compact Developer Documentation

Short description
- Kohina is a React + Supabase audio sharing app. Users upload audio, add covers, create playlists, follow creators and play tracks with a global audio player.

Table of contents
- Overview
- Quick start
- Required environment variables
- Supabase: database tables & recommended columns
- Storage buckets & access rules
- Project structure & responsibilities
- Common scripts
- Deployment notes
- Troubleshooting
- Security & best practices
- Contributing & contact

Overview
- Client-side SPA built with React, Tailwind CSS and Supabase (Auth, Postgres, Storage).
- Audio files are kept in a private storage bucket and served via signed URLs.
- Avatars and track images are public (with cache-busting when updated).

Quick start (development)
1. Clone the repo:
   - git clone <your-repo-url>
2. Install:
   - npm install
3. Create a Vite .env file in project root (see "Required environment variables")
4. Start dev server:
   - npm run dev
5. Visit http://localhost:5173 (port depends on Vite)

Required environment variables
- VITE_SUPABASE_URL — e.g. https://xxxx.supabase.co
- VITE_SUPABASE_ANON_KEY — Supabase anon/public key
- (Optional for advanced usage) VITE_SUPABASE_SERVICE_KEY — service_role (do NOT commit)

Supabase: recommended DB tables (compact)
- profiles
  - id (uuid, primary) — matches auth.user.id
  - username (text)
  - bio (text)
  - location (text)
  - avatar_url (text)
  - updated_at (timestamp)

- tracks
  - id (uuid, primary)
  - user_id (uuid) — foreign to profiles.id
  - title, artist, album (text)
  - audio_path (text) — storage path in `audio` bucket
  - image_path (text) — storage path in `track-images` bucket
  - mime_type (text)
  - file_size (int)
  - genre_id (int) — foreign to genres.id
  - is_public (boolean)
  - created_at, updated_at, deleted_at (timestamps)

- genres
  - id (int, primary)
  - name (text)
  - description (text)

- playlists
  - id (uuid)
  - owner (uuid) — user id
  - title (text)
  - description (text)
  - is_public (boolean)
  - updated_at

- playlist_tracks
  - id (uuid)
  - playlist_id (uuid)
  - track_id (uuid)
  - position (int)
  - added_by (uuid)

- followers
  - id (uuid)
  - follower_id (uuid)
  - followed_id (uuid)
  - created_at

Storage buckets & access rules
- audio (private)
  - Purpose: store uploaded audio files.
  - Access: private — serve with signed URLs (createSignedUrl).
  - Signed URL TTL: default code uses 3600s; adjust per need.
- track-images (public)
  - Purpose: cover art for tracks.
  - Access: public read.
- avatars (public)
  - Purpose: user avatars.
  - Access: public read.
- Best practice: append a timestamp query param to public URLs after upload to bust caches when users update images.

Project structure (high level)
- src/
  - App.jsx — global audio player, player API, signed URL logic
  - Router.jsx — route definitions and auth gating
  - supabaseclient.js — shared Supabase client + helpers
  - pages/ — page-level components (Home, Profile, Upload)
  - components/ — reusable UI (NavBar, UserProfile, AddToPlaylist, protectedRoutes)
  - utils/ — helper utilities (e.g., securityUtils.js)

Key behaviors
- Authentication: Supabase Auth + Auth UI on the root route. ProtectedRoute wrapper enforces session presence.
- Audio playback: App creates signed URL for private audio then sets audio.src, handles play/pause/stop and global state.
- Avatars & track-images: public URLs with cache busting query param appended on upload.

Common scripts
- npm run dev — start dev server
- npm run build — build for production (Vite)
- npm run preview — preview production build (Vite)
- npm test — (if tests exist) run unit tests

Deployment notes
- Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your hosting platform (Vercel, Netlify, etc.).
- Ensure static assets (public/default-avatar.png and any background images) are included in build output.
- For production consider rotating keys and limiting service_role usage to server-side operations only.

Troubleshooting
- "Audio unavailable" — confirm file exists in storage and audio_path saved in tracks table.
- Signed URL errors — ensure the bucket name and object path are correct; check permissions in Supabase storage policy.
- CORS/Playback errors — confirm your hosting and Supabase project allow requests from your app origin; check browser console for network errors.

Security & best practices
- Never commit VITE_SUPABASE_ANON_KEY or service keys to public repos.
- Validate uploads server-side where possible; client-side validation (src/utils/securityUtils.js) helps UX but is not sufficient.
- Use RLS (row-level security) policies in Supabase to prevent unauthorized writes/reads (e.g., profiles upsert allowed only for the profile owner).
- For sensitive admin operations require a server-side function using the service_role key.

Schema & migration tips
- Keep a SQL file or use Supabase SQL migrations to define tables and indexes.
- Add unique constraint for followers (follower_id, followed_id) to prevent duplicates.
- Add db index on tracks.user_id, tracks.is_public, playlists.owner for query performance.

Contributing
- Use branches for features/fixes.
- Follow existing code patterns: data fetching inside useEffect, keep UI state local to components, centralize Supabase usage via src/supabaseclient.js.
- Add tests for any business logic added to utils/.

Contact
- Developer: Matia (local project). Use repository issues for clarifications or to propose schema changes.

License
- Keep project license in repo (e.g., MIT) — add LICENSE file if needed.

Appendix — Quick example: create a signed URL (client)
- In App.jsx the flow is:
  1. supabase.storage.from('audio').createSignedUrl(path, 3600)
  2. set audio element src to returned signedUrl
  3. play()

Appendix — Minimal RLS hints
- profiles: allow update where auth.uid() = id
- tracks: allow insert where auth.uid() = user_id; allow read where is_public = true or user_id = auth.uid()
