import type { SyncResult } from '@/domains/sessions/main/sync/session-sync-machine'

export type SessionDiscoveryInput = {
  knownNativeIds: readonly string[]
}

export type SessionDiscovery = (input: SessionDiscoveryInput) => Promise<SyncResult>
