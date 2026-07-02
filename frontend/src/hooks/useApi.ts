import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000/api'

type ApiError = Error & { status?: number }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: 'include' })
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    const err: ApiError = new Error(body.message || `HTTP ${r.status}`)
    err.status = r.status
    throw err
  }
  return r.json()
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok && r.status !== 204) {
    const data = await r.json().catch(() => ({}))
    const err: ApiError = new Error(data.message || `HTTP ${r.status}`)
    err.status = r.status
    throw err
  }
  if (r.status === 204) return undefined as T
  return r.json()
}

export function useApi<T>(path: string, enabled = true) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => get<T>(path),
    enabled,
    retry: (failureCount, error) => (error as ApiError).status !== 401 && failureCount < 2,
  })
}

export function useApiMutation<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: unknown) => mutate<T>(path, method, body),
    onSettled: () => { qc.invalidateQueries({ queryKey: [path] }) },
  })
}
