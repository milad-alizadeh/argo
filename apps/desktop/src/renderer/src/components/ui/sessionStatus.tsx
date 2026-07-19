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
// tells them apart (colour never carries state alone).
export const STATUS_TONE: Record<StatusTone, { dotClass: string; textClass: string }> = {
  run: { dotClass: 'bg-status-working', textClass: 'text-status-working' },
  amber: { dotClass: 'bg-status-awaiting-input', textClass: 'text-status-awaiting-input' },
  mist: { dotClass: 'bg-status-idle', textClass: 'text-status-idle' },
  gray: { dotClass: 'bg-status-idle', textClass: 'text-status-idle' },
  red: { dotClass: 'bg-status-failed', textClass: 'text-status-failed' },
  stale: { dotClass: 'bg-status-exited', textClass: 'text-status-exited' },
  landed: { dotClass: 'bg-status-landed', textClass: 'text-status-landed' },
}

// Single source of a Session status's presentation — label, lifecycle tone, colour token
// classes, and its Phosphor icon. Every status atom reads this map so the four states are
// defined once (no per-atom switch to drift).
export const SESSION_STATUS: Record<
  SessionStatus,
  { label: string; tone: StatusTone; dotClass: string; textClass: string; Icon: Icon }
> = {
  working: { label: 'Working', tone: 'run', ...STATUS_TONE.run, Icon: CircleNotchIcon },
  idle: { label: 'Idle', tone: 'mist', ...STATUS_TONE.mist, Icon: CircleIcon },
  'awaiting-input': {
    label: 'Awaiting input',
    tone: 'amber',
    ...STATUS_TONE.amber,
    Icon: WarningIcon,
  },
  exited: { label: 'Exited', tone: 'stale', ...STATUS_TONE.stale, Icon: CheckCircleIcon },
}
