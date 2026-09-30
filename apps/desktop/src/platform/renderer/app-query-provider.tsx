import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SessionChanges } from '@/domains/sessions/renderer/session-changes'
import { Toaster } from './components/ui/toast'
import { queryClient } from './trpc-client'

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionChanges />
      <Toaster>{children}</Toaster>
    </QueryClientProvider>
  )
}
