import type { SessionStatus } from '@/sessionStore'
import { CheckCircleIcon, CircleIcon, CircleNotchIcon, type IconAtom, WarningIcon } from './icons'

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
// one state cannot be spelled two ways on two surfaces. A Session is Working; the Runs and
// Agents inside it are Running / Queued / Done — different objects, so both words exist.
export type StatusState =
  | SessionStatus
  | 'running'
  | 'queued'
  | 'done'
  | 'failed'
  | 'interrupted'
  | 'orphaned'
  | 'live'

export const STATUS_STATE: Record<StatusState, { word: string; tone: StatusTone }> = {
  working: { word: 'Working', tone: 'run' },
  idle: { word: 'Idle', tone: 'mist' },
  'awaiting-input': { word: 'Awaiting input', tone: 'amber' },
  exited: { word: 'Exited', tone: 'stale' },
  running: { word: 'Running', tone: 'run' },
  queued: { word: 'Queued', tone: 'gray' },
  done: { word: 'Done', tone: 'mist' },
  failed: { word: 'Failed', tone: 'red' },
  interrupted: { word: 'Interrupted', tone: 'amber' },
  orphaned: { word: 'Orphaned', tone: 'stale' },
  live: { word: 'live', tone: 'run' },
}

// The icon atom each Session lifecycle state wears — the only thing the Session-only view
// of the vocabulary owns; its word and tone still come from STATUS_STATE.
export const SESSION_ICON: Record<SessionStatus, IconAtom> = {
  working: CircleNotchIcon,
  idle: CircleIcon,
  'awaiting-input': WarningIcon,
  exited: CheckCircleIcon,
}
