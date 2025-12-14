import { useCallback, useState } from 'react'
import { supabase } from '../supabaseclient'

const isJwtLike = (token) => typeof token === 'string' && token.split('.').length === 3
const tryGetJwtExpIso = (token) => {
  try {
    if (!isJwtLike(token)) return null
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(base64))
    return json?.exp ? new Date(json.exp * 1000).toISOString() : null
  } catch {
    return null
  }
}

const getFunctionsBaseUrl = () => {
  const base = (supabase?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) throw new Error('Missing Supabase URL (VITE_SUPABASE_URL).')
  return `${base}/functions/v1`
}

const getAnonKey = () => {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!key) throw new Error('Missing Supabase anon key (VITE_SUPABASE_ANON_KEY).')
  return key
}

const parseFilenameFromContentDisposition = (cd) => {
  if (!cd) return null
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd)
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'gdpr-export'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const getFreshAccessToken = async () => {
  const { data: s1, error: e1 } = await supabase.auth.getSession()
  if (e1) throw e1
  let current = s1?.session
  if (!current) throw new Error('Not authenticated.')

  const expiresAtMs = (current.expires_at || 0) * 1000
  const shouldRefresh = expiresAtMs && expiresAtMs < Date.now() + 30_000
  if (shouldRefresh) {
    const { data: s2, error: e2 } = await supabase.auth.refreshSession()
    if (e2) throw e2
    current = s2?.session || current
  }

  if (!current?.access_token) throw new Error('Missing access token.')
  return current.access_token
}

export function useGdprExport(session) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [jsonResult, setJsonResult] = useState(null)
  const [downloadInfo, setDownloadInfo] = useState(null)

  const runExport = useCallback(async () => {
    setError(null)
    setJsonResult(null)
    setDownloadInfo(null)
    setLoading(true)

    try {
      const token = await getFreshAccessToken()
      const anonKey = getAnonKey()

      if (!token) throw new Error('Missing access token.')
      if (import.meta.env.DEV) {
        console.debug('[GDPR export] token meta', {
          len: token?.length || 0,
          jwtLike: isJwtLike(token),
          exp: tryGetJwtExpIso(token),
          sessionUserId: session?.user?.id,
        })
      }

      const url = `${getFunctionsBaseUrl()}/gdpr-export`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
          Accept: 'application/json, application/octet-stream, application/gzip, */*',
          'X-Client-Info': 'gdpr-export-client',
        },
        body: JSON.stringify({}),
      })

      const contentType = res.headers.get('content-type') || ''
      const contentDisposition = res.headers.get('content-disposition') || ''

      if (import.meta.env.DEV) {
        console.debug('[GDPR export] response meta', {
          status: res.status,
          contentType,
          contentDisposition,
        })
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Export failed (HTTP ${res.status}).`)
      }

      if (contentType.includes('application/json')) {
        const data = await res.json()
        setJsonResult(data)
        return
      }

      const blob = await res.blob()
      const filename =
        parseFilenameFromContentDisposition(contentDisposition) ||
        (contentType.includes('application/zip')
          ? 'gdpr-export.zip'
          : contentType.includes('application/gzip')
            ? 'gdpr-export.gz'
            : 'gdpr-export.bin')

      downloadBlob(blob, filename)
      setDownloadInfo(`Downloaded: ${filename}`)
    } catch (e) {
      setError(e?.message || 'Export failed.')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  const downloadJson = useCallback(() => {
    if (!jsonResult) return
    const json = JSON.stringify(jsonResult, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    downloadBlob(blob, 'gdpr-export.json')
  }, [jsonResult])

  return { loading, error, jsonResult, downloadInfo, runExport, downloadJson }
}
