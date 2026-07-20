import type { RailTone } from '@/ship'

// `mist` and `gray` resolve to the same token deliberately — done and queued read
// identically in colour and only the word beside them tells them apart. A tone is one
// colour class: a dot takes both its fill and its glow from currentColor.
export const STATUS_TONE: Record<RailTone, string> = {
  run: 'text-status-working',
  amber: 'text-status-awaiting-input',
  mist: 'text-status-idle',
  gray: 'text-status-idle',
  red: 'text-status-failed',
  stale: 'text-status-exited',
  landed: 'text-status-landed',
}
