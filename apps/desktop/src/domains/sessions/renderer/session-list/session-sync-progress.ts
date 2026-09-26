import type { RouterOutputs } from '@/platform/renderer/trpc-client'

type SessionSyncStatus = Extract<RouterOutputs['sessionSyncStatus'], { type: 'status' }>['status']

export function sessionSyncProgress(status: SessionSyncStatus): number | null {
  if (status.phase === 'fetching' || status.total === null) return null
  if (status.total === 0) return 100
  return (status.processed / status.total) * 100
}
