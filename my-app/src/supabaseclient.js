/**
 * supabaseclient.js
 * - Exposes a shared Supabase client and helper utilities for creating public storage URLs.
 * - Reads credentials from Vite environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 */

import { createClient } from '@supabase/supabase-js'

//creates supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Warn early if environment is not configured
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment')
}

/**
 * Returns a public-facing URL for a file stored in Supabase Storage.
 * @param {string} bucket - The storage bucket name.
 * @param {string} path - The object path within the bucket.
 * @returns {string|null} Public URL or null if parameters missing.
 */
export const getPublicStorageUrl = (bucket, path) => {
  if (!supabaseUrl || !path) return null
  // Supabase public storage objects are available under /storage/v1/object/public/{bucket}/{path}
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}

// Create and export a single Supabase client instance used across the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
