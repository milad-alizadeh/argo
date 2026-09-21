// The Feed uses the same state names and status marks as the Roster.
import type { WorkState } from '@/domains/sessions/renderer/work/session-work'

export type DelegationPhase = 'running' | 'succeeded' | 'failed' | 'interrupted'

export const DELEGATION_PHASE_WORK_STATES = {
  failed: 'failed',
  interrupted: 'interrupted',
  running: 'running',
  succeeded: 'done',
} as const satisfies Record<DelegationPhase, WorkState>
