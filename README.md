 # Kohina — Developer Guide

 React + Supabase music sharing app. Users upload audio, add covers, create playlists, follow creators, and play tracks through a global audio player with queue controls.

 ## Contents
 - What it does
 - Architecture map
 - Stack and requirements
 - Setup (dev)
 - Environment variables
 - Supabase schema and storage
 - Key flows (auth, playback, likes, comments, playlists)
 - Scripts
 - Deployment notes
 - Troubleshooting
 - Security and data protection
 - Contributing and contact

 ## What it does
 - Auth (Supabase email + Google), protected routes, password reset.
 - Upload audio, compress/validate client-side, attach cover images, and store privately via signed URLs.
 - Global audio player with play/pause/seek/next/previous, queue navigation, fullscreen view, and visualizer.
 - Social actions: like/unlike with optimistic updates, comments with rate limiting, follow creators, playlists and “add to playlist.”
 - Profile pages with avatar, bio, settings, and GDPR export panel.

 ## Architecture map
 - Routing and auth: [my-app/src/Router.jsx](my-app/src/Router.jsx) manages Supabase session, protected routes, login layout, privacy/terms pages.
 - Player and app shell: [my-app/src/App.jsx](my-app/src/App.jsx) wires the global audio player, signed URL fetching, queue handling, and renders `GlobalAudioPlayer`.
 - Supabase client: [my-app/src/supabaseclient.js](my-app/src/supabaseclient.js) creates the client and public URL helper for storage.
 - Feature hooks: likes [my-app/src/hooks/useLikesV2.js](my-app/src/hooks/useLikesV2.js), play-count tracking [my-app/src/hooks/useIncrementPlayCount.js](my-app/src/hooks/useIncrementPlayCount.js), comments [my-app/src/hooks/useComments.js](my-app/src/hooks/useComments.js).
 - Utilities: security and validation [my-app/src/utils/securityUtils.js](my-app/src/utils/securityUtils.js); play-count edge call [my-app/src/utils/incrementPlayCount.js](my-app/src/utils/incrementPlayCount.js); comment helpers [my-app/src/utils/commentUtils.js](my-app/src/utils/commentUtils.js).
 - UI components: track cards, playlists, modals, navbar, etc. live under [my-app/src/components](my-app/src/components).

 ## Stack and requirements
 - React 18, Vite, Tailwind CSS.
 - Supabase (Auth, Postgres, Storage, Edge Functions).
 - Node 18+ recommended. npm for scripts.

 ## Setup (dev)
 1) Install deps
 ```bash
 npm install
 ```
 2) Create `my-app/.env` with the variables below.
 3) Start dev server
 ```bash
 npm run dev
 ```
 4) Open the shown Vite URL (default http://localhost:5173).

 ## Environment variables (my-app/.env)
 - VITE_SUPABASE_URL — e.g. https://xxxx.supabase.co
 - VITE_SUPABASE_ANON_KEY — Supabase anon/public key
 - (Optional) VITE_SUPABASE_SERVICE_KEY — service_role for server-side or local admin tasks only (do not ship to clients)

 ## Supabase schema (recommended)
 - profiles: id (uuid, pk, matches auth.user.id), username, bio, location, avatar_url, updated_at.
 - tracks: id (uuid), user_id (uuid fk profiles), title, artist, album, audio_path, image_path, mime_type, file_size, genre_id, is_public, created_at/updated_at/deleted_at.
 - genres: id (int), name, description.
 - playlists: id (uuid), owner (uuid), title, description, is_public, updated_at.
 - playlist_tracks: id (uuid), playlist_id (uuid), track_id (uuid), position, added_by (uuid).
 - followers: id (uuid), follower_id (uuid), followed_id (uuid), created_at.
 - track_likes: id (uuid), user_id (uuid), track_id (uuid), created_at (used by `useLikesV2`).
 - track_comments: id (uuid), track_id (uuid), user_id (uuid), body, created_at, updated_at, deleted_at (used by `useComments`).

 ## Storage buckets
 - audio (private): audio files served via signed URLs (default TTL 3600s in client code).
 - track-images (public): cover art; append cache-busting query param after updates.
 - user-backgrounds (public) background images in profile pages.
 - avatars (public): user avatars.

 ## Key flows
 - Authentication: Supabase auth state is read in [my-app/src/Router.jsx](my-app/src/Router.jsx); unauthenticated users see the Supabase Auth UI and are redirected to /home after login.
 - Playback: [my-app/src/App.jsx](my-app/src/App.jsx) builds a player API (play/pause/resume/stop/next/previous, queue length) and fetches signed URLs for private audio before playback.
 - Play count: [my-app/src/utils/incrementPlayCount.js](my-app/src/utils/incrementPlayCount.js) calls the Edge Function `functions/v1/increase-playcount` with the user access token; [my-app/src/hooks/useIncrementPlayCount.js](my-app/src/hooks/useIncrementPlayCount.js) wraps it for React.
 - Likes: [my-app/src/hooks/useLikesV2.js](my-app/src/hooks/useLikesV2.js) provides optimistic like/unlike with rate limiting (2s) and duplicate-request protection using `track_likes`.
 - Comments: [my-app/src/hooks/useComments.js](my-app/src/hooks/useComments.js) handles fetch/post/edit/delete with 5s rate limit per track; uses [my-app/src/utils/commentUtils.js](my-app/src/utils/commentUtils.js) and `track_comments`.
 - Upload: audio is validated client-side via [my-app/src/utils/securityUtils.js](my-app/src/utils/securityUtils.js) (type/size/extension checks) before uploading to Supabase storage.

 ## Scripts
 - npm run dev — start Vite dev server.
 - npm run build — production build.
 - npm run preview — preview production build.
 - npm run lint — lint with ESLint 9.
 - npm run deploy — deploy built `dist` to Cloudflare Pages via Wrangler (project: kohina-music-sharing-platform).

 ## Deployment notes
 - Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the hosting environment.
 - Build with `npm run build`, then serve `dist` (Cloudflare Pages via `npm run deploy`, or your host of choice).
 - Ensure public assets (favicons, manifest, default avatar) remain under `public/` at build time.

 ## Troubleshooting
 - Audio unavailable: ensure `tracks.audio_path` points to an existing object in the `audio` bucket and the signed URL is valid.
 - Signed URL failures: verify bucket name/path and Supabase storage policies; check console network errors.
 - Likes/comments not persisting: confirm RLS policies allow the user on `track_likes`/`track_comments`; watch rate-limit messages in the UI.
 - Play count not increasing: confirm the Edge Function `increase-playcount` is deployed and Supabase JWT is sent; check function logs.

 ## Security and data protection
 - Never commit keys. Keep `.env` out of version control.
 - Enforce Supabase RLS: owners-only writes on profiles, tracks, playlists, comments, likes; public reads only where intended.
 - Validate uploads server-side; client validation in [my-app/src/utils/securityUtils.js](my-app/src/utils/securityUtils.js) is for UX, not security.
 - Consider quotas and rate limits for uploads and interactions; client-side rate limits exist for likes and comments.

 ## Contributing and contact
 - Use feature branches; keep data fetching in effects and centralize Supabase access through [my-app/src/supabaseclient.js](my-app/src/supabaseclient.js).
 - Add tests for new business logic in utils or hooks.
 - Contact: Matia (project owner). Use repo issues for questions or schema proposals.
