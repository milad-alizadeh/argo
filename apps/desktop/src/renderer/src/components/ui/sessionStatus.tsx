import {
  CheckCircleIcon,
  CircleIcon,
  CircleNotchIcon,
  type Icon,
  WarningIcon,
} from '@phosphor-icons/react'
import type { SessionStatus } from '@/sessionStore'

// Single source of a Session status's presentation — label, colour token classes, and
// its Phosphor icon. Every status atom reads this map so the four states are defined
// once (no per-atom switch to drift).
export const SESSION_STATUS: Record<
  SessionStatus,
  { label: string; dotClass: string; textClass: string; Icon: Icon }
> = {
  working: {
    label: 'Working',
    dotClass: 'bg-status-working',
    textClass: 'text-status-working',
    Icon: CircleNotchIcon,
  },
  idle: {
    label: 'Idle',
    dotClass: 'bg-status-idle',
    textClass: 'text-status-idle',
    Icon: CircleIcon,
  },
  'awaiting-input': {
    label: 'Awaiting input',
    dotClass: 'bg-status-awaiting-input',
    textClass: 'text-status-awaiting-input',
    Icon: WarningIcon,
  },
  exited: {
    label: 'Exited',
    dotClass: 'bg-status-exited',
    textClass: 'text-status-exited',
    Icon: CheckCircleIcon,
  },
}
