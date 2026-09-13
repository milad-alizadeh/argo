import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { createQueryClient } from '../../../lib/query-client'
import { ProjectsProvider } from '../../projects/state/ProjectsContext'

// The window's shared state: one Query cache and one Project reading. A story mounts its own, so
// no cached reply leaks from one story into the next.
export function CockpitProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  return (
    <QueryClientProvider client={client}>
      <ProjectsProvider>{children}</ProjectsProvider>
    </QueryClientProvider>
  )
}
