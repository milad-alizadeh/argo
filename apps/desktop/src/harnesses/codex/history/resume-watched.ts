import type { SessionPosture } from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'

export const LEASE_REFUSAL = 'Another Argo window is driving this Codex Session.'

// Vendor liveness, then the SQLite lease, and only then a managed channel (#2581).
export async function beginWatchedResume(options: {
  readPermission: () => Promise<{ resumable: true } | { resumable: false; reason: string }>
  acquireLease: () => { posture: SessionPosture }
  releaseLease: () => void
  openManaged: () => Promise<SessionCommandOutcome>
}): Promise<SessionCommandOutcome> {
  const permission = await options.readPermission()
  if (!permission.resumable) return { kind: 'rejected', reason: permission.reason }
  if (options.acquireLease().posture !== 'managed') {
    return { kind: 'rejected', reason: LEASE_REFUSAL }
  }
  try {
    return await options.openManaged()
  } catch (error) {
    options.releaseLease()
    return {
      kind: 'rejected',
      reason: error instanceof Error ? error.message : 'Codex refused to resume this Session.',
    }
  }
}
