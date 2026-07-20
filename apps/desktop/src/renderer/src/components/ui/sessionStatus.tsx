import {
  CheckCircleIcon,
  CircleIcon,
  CircleNotchIcon,
  type Icon,
  WarningIcon,
} from '@phosphor-icons/react'
import type { SessionStatus } from '@/sessionStore'

export type StatusTone = 'run' | 'amber' | 'mist' | 'gray' | 'red' | 'stale' | 'landed'

// The cockpit's lifecycle palette. `mist` and `gray` deliberately resolve to the same
// token — done and queued read identically in colour, and only the word beside them
// tells them apart (colour never carries state alone). A tone is one colour class: a dot
// takes its fill and its glow from currentColor, so there is no background variant to
// keep in step.
export const STATUS_TONE: Record<StatusTone, { textClass: string }> = {
  run: { textClass: 'text-status-working' },
  amber: { textClass: 'text-status-awaiting-input' },
  mist: { textClass: 'text-status-idle' },
  gray: { textClass: 'text-status-idle' },
  red: { textClass: 'text-status-failed' },
  stale: { textClass: 'text-status-exited' },
  landed: { textClass: 'text-status-landed' },
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

function sessionEntry(
  state: SessionStatus,
  Icon: Icon,
): { label: string; tone: StatusTone; textClass: string; Icon: Icon } {
  const { word, tone } = STATUS_STATE[state]
  return { label: word, tone, ...STATUS_TONE[tone], Icon }
}

// The Session-only view of that vocabulary: the four lifecycle states plus the icon each
// one wears. Words come from STATUS_STATE, so there is one table, not two.
export const SESSION_STATUS: Record<
  SessionStatus,
  { label: string; tone: StatusTone; textClass: string; Icon: Icon }
> = {
  working: sessionEntry('working', CircleNotchIcon),
  idle: sessionEntry('idle', CircleIcon),
  'awaiting-input': sessionEntry('awaiting-input', WarningIcon),
  exited: sessionEntry('exited', CheckCircleIcon),
}
