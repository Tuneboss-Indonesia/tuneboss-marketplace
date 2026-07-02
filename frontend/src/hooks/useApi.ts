import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000/api'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

export function useApi<T>(endpoint: string, options?: { enabled?: boolean }) {
  return useQuery<T>({
    queryKey: [endpoint],
    queryFn: () => fetchApi<T>(endpoint),
    enabled: options?.enabled,
  })
}

export function useApiMutation<T>(endpoint: string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: unknown) =>
      fetchApi<T>(endpoint, {
        method,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
    },
  })
}
