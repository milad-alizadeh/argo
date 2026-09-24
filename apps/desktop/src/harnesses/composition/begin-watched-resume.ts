import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'

export async function beginWatchedResume(options: {
  openFailure: string
  readPermission: () => Promise<{ resumable: true } | { resumable: false; reason: string }>
  openManaged: () => Promise<SessionCommandOutcome>
}): Promise<SessionCommandOutcome> {
  const permission = await options.readPermission()
  if (!permission.resumable) return { kind: 'rejected', reason: permission.reason }
  try {
    return await options.openManaged()
  } catch (error) {
    return {
      kind: 'rejected',
      reason: error instanceof Error ? error.message : options.openFailure,
    }
  }
}
