import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

let client: QueryClient | undefined

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => {
    if (!client) client = makeClient()
    return client
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}