import type { z } from 'zod'
import type { sessionInsertSchema } from '@/database/session/validation'

export type DiscoveredSession = Omit<z.infer<typeof sessionInsertSchema>, 'harness'>

export type SessionDiscoveryResult = {
  records: DiscoveredSession[]
  skipped: number
}

export type SessionDiscoveryInput = {
  // Stored Sessions the listing may omit, read one by one after it.
  knownNativeIds: readonly string[]
}

export type SessionSummaryList = (input: SessionDiscoveryInput) => Promise<SessionDiscoveryResult>

// One Session's summary, or null while the Harness does not list it.
export type SessionSummaryReader = (nativeId: string) => Promise<DiscoveredSession | null>
