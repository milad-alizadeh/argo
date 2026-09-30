import type { z } from 'zod'
import type { sessionInsertSchema } from '@/database/session/validation'

export type DiscoveredSession = Omit<z.infer<typeof sessionInsertSchema>, 'harness'>

export type SessionDiscoveryResult = {
  records: DiscoveredSession[]
  skipped: number
}

export type SessionDiscoveryInput =
  // A sync: list every Session, and also read these stored ones the listing may omit.
  | { knownNativeIds: readonly string[]; nativeId?: never }
  // A Session the history watcher saw first: read only it, with no listing.
  | { nativeId: string; knownNativeIds?: never }

export type SessionDiscovery = (input: SessionDiscoveryInput) => Promise<SessionDiscoveryResult>
