import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { ApiResponse } from '../lib/api'

export function useApi<T>(path: string, skip = false) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (skip) return

    setLoading(true)
    setError(null)
    try {
      const res: ApiResponse<T> = await api.get<T>(path)
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError(res.error || 'Unknown error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [path, skip])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
