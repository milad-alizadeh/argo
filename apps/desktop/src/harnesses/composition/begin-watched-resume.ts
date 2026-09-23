import type { SessionPosture } from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'

export async function beginWatchedResume(options: {
  leaseRefusal: string
  openFailure: string
  readPermission: () => Promise<{ resumable: true } | { resumable: false; reason: string }>
  acquireLease: () => { posture: SessionPosture }
  releaseLease: () => void
  openManaged: () => Promise<SessionCommandOutcome>
}): Promise<SessionCommandOutcome> {
  const permission = await options.readPermission()
  if (!permission.resumable) return { kind: 'rejected', reason: permission.reason }
  if (options.acquireLease().posture !== 'managed') {
    return { kind: 'rejected', reason: options.leaseRefusal }
  }
  try {
    return await options.openManaged()
  } catch (error) {
    options.releaseLease()
    return {
      kind: 'rejected',
      reason: error instanceof Error ? error.message : options.openFailure,
    }
  }
}
