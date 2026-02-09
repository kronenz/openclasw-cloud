const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const json: ApiResponse<T> = await res.json()
    return json
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
