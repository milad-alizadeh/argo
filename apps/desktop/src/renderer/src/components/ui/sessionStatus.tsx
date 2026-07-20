import type { SessionStatus } from '@/sessionStore'
import { CheckIcon, CircleIcon, CircleNotchIcon, type IconAtom, WarningIcon, XIcon } from './icons'

export type StatusTone = 'run' | 'amber' | 'mist' | 'gray' | 'red' | 'stale' | 'landed'

// `mist` and `gray` resolve to the same token deliberately — done and queued read
// identically in colour and only the word beside them tells them apart. A tone is one
// colour class: a dot takes both its fill and its glow from currentColor.
export const STATUS_TONE: Record<StatusTone, string> = {
  run: 'text-status-working',
  amber: 'text-status-awaiting-input',
  mist: 'text-status-idle',
  gray: 'text-status-idle',
  red: 'text-status-failed',
  stale: 'text-status-exited',
  landed: 'text-status-landed',
}

// The cockpit's whole status vocabulary. A caller passes a state key and never a word, so
// one state cannot be spelled two ways on two surfaces. A Session's six states are the
// contract's `SessionStatus`; the extra keys belong to the Runs and Agents inside it.
export type StatusState = SessionStatus | 'interrupted' | 'live'

export const STATUS_STATE: Record<StatusState, { word: string; tone: StatusTone }> = {
  running: { word: 'Running', tone: 'run' },
  'needs-input': { word: 'Needs input', tone: 'amber' },
  done: { word: 'Done', tone: 'mist' },
  failed: { word: 'Failed', tone: 'red' },
  queued: { word: 'Queued', tone: 'gray' },
  orphaned: { word: 'Orphaned', tone: 'stale' },
  interrupted: { word: 'Interrupted', tone: 'amber' },
  live: { word: 'live', tone: 'run' },
}

// The icon atom each Session state wears — the only thing the Session-only view of the
// vocabulary owns; its word and tone still come from STATUS_STATE. Queued and orphaned
// share the resting circle and are told apart by tone, as the matrix's rail column is.
export const SESSION_ICON: Record<SessionStatus, IconAtom> = {
  running: CircleNotchIcon,
  'needs-input': WarningIcon,
  done: CheckIcon,
  failed: XIcon,
  queued: CircleIcon,
  orphaned: CircleIcon,
}
