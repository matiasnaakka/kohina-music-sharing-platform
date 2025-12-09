import { useState, useCallback } from 'react'
import { incrementPlayCount } from '../utils/incrementPlayCount'

/**
 * Hook to manage track play count increments
 * @returns {Object} { increment, loading, error }
 */
export function useIncrementPlayCount() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const increment = useCallback(async (trackId) => {
    setLoading(true)
    setError(null)
    try {
      const newCount = await incrementPlayCount(trackId)
      setLoading(false)
      return newCount
    } catch (err) {
      setError(err)
      setLoading(false)
      throw err
    }
  }, [])
  
  return { increment, loading, error }
}
