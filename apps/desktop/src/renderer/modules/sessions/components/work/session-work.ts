// How the work inspector words a Subagent's or a Shell's two facts: how long it has been going,
// and what it spent (#1582). A running row is measured against now, so the caller passes the
// clock rather than this module reading one.
import type { TFunction } from 'i18next'
import type { SessionDelegation, SessionShellCommand, ShellState } from '@/core/sessions/models'

// What a header button or a Feed block opens: a Subagent with what it spent, or a Shell.
export type SessionWork =
  | {
      kind: 'delegation'
      delegation: SessionDelegation
      tokens: number | null
      model: string | null
    }
  | { kind: 'shell'; command: SessionShellCommand }

// A Subagent settles as `done`; a shell command keeps the CLI's own word for how it ended.
export type WorkState = ShellState | 'done'

// The semantic ground a state mark takes, the same set the Roster draws a Session's status in.
export const WORK_STATE_MARKS: Record<WorkState, string> = {
  running: 'bg-active shadow-state-glow',
  done: 'bg-idle',
  completed: 'bg-idle',
  failed: 'bg-danger',
  killed: 'bg-warn',
  stopped: 'bg-warn',
}

export function delegationState(delegation: SessionDelegation): WorkState {
  return delegation.landed ? 'done' : 'running'
}

function elapsed(startedAt: string | null, endedAt: string | null, now: number): number | null {
  if (startedAt === null) return null
  const from = Date.parse(startedAt)
  if (Number.isNaN(from)) return null
  const to = endedAt === null ? now : Date.parse(endedAt)
  if (Number.isNaN(to)) return null
  return Math.max(0, to - from)
}

export function workDuration(
  startedAt: string | null,
  endedAt: string | null,
  now: number,
): string | null {
  const span = elapsed(startedAt, endedAt, now)
  if (span === null) return null
  const seconds = Math.floor(span / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// One significant decimal under ten of a unit, none above it: `2.7k` and `18k` both read at a
// glance, and `18.4k` only adds a digit nobody acts on.
function scaled(tokens: number, unit: number, suffix: string) {
  const value = tokens / unit
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)}${suffix}`
}

export function compactTokens(tokens: number | null): string | null {
  if (tokens === null) return null
  if (tokens < 1000) return `${tokens}`
  if (tokens < 1_000_000) return scaled(tokens, 1000, 'k')
  return scaled(tokens, 1_000_000, 'M')
}

const MODEL_BRANDS: Record<string, string> = { claude: 'Claude', gpt: 'GPT' }

// Transcript model ids are stable transport values. The reader sees the model's product name.
export function displayModel(model: string | null): string | null {
  if (model === null) return null
  return model
    .split('-')
    .map((word) => MODEL_BRANDS[word] ?? `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`)
    .join(' ')
}

export function spentTokens(tokens: number | null, t: TFunction<'sessions'>): string | null {
  const amount = compactTokens(tokens)
  return amount === null ? null : t('delegation.tokens', { amount })
}
