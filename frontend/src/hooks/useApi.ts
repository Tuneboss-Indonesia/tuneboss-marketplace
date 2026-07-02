import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000/api'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { credentials: 'include' })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`)
  return r.json()
}

async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok && r.status !== 204) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`)
  return r.json()
}

export function useApi<T>(path: string, enabled = true) {
  return useQuery<T>({ queryKey: [path], queryFn: () => get<T>(path), enabled })
}

export function useApiMutation<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: unknown) => mutate<T>(path, method, body),
    onSettled: () => { qc.invalidateQueries({ queryKey: [path] }) },
  })
}