/**
 * supabaseclient.js
 * - Exposes a shared Supabase client and helper utilities for creating public storage URLs.
 * - Reads credentials from Vite environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 */

import { createClient } from '@supabase/supabase-js'

// Create supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment on initialization
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = []
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY')
  
  console.error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    `Please add them to your .env file.`
  )
  
  // Throw error in production
  if (import.meta.env.PROD) {
    throw new Error(`Missing critical environment variables: ${missingVars.join(', ')}`)
  }
}

/**
 * Returns a public-facing URL for a file stored in Supabase Storage.
 * @param {string} bucket - The storage bucket name.
 * @param {string} path - The object path within the bucket.
 * @returns {string|null} Public URL or null if parameters missing.
 */
export const getPublicStorageUrl = (bucket, path) => {
  if (!supabaseUrl || !path) return null
  
  // Validate inputs to prevent injection attacks
  if (typeof bucket !== 'string' || typeof path !== 'string') return null
  
  // Ensure no null bytes or suspicious patterns
  if (bucket.includes('\0') || path.includes('\0')) return null
  
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`
}

// Create and export a single Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
