import type { z } from 'zod'
import type { sessionInsertSchema } from '@/database/session/validation'

export type DiscoveredSession = Omit<z.infer<typeof sessionInsertSchema>, 'harness'>

export type SessionDiscoveryResult = {
  records: DiscoveredSession[]
  skipped: number
}

export type SessionDiscoveryInput = {
  knownNativeIds: readonly string[]
  // Read this one Session and skip the listing.
  nativeId?: string
}

export type SessionDiscovery = (input: SessionDiscoveryInput) => Promise<SessionDiscoveryResult>
