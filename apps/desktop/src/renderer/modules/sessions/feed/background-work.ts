import { createContext } from 'react'
import {
  type SessionDelegation,
  type SessionShellCommand,
  SHELL_STATES,
  type ShellState,
} from '@/core/sessions/models'
import type { SessionFeedRow } from '../types'

export type BackgroundWorkTarget =
  | { kind: 'delegation'; delegation: SessionDelegation; tokens: number | null }
  | { kind: 'shell'; command: SessionShellCommand }

export type BackgroundWorkLinks = {
  // By the call a notification names, or else by the name an agent was given when it was sent.
  find: (work: { callId: string | null; name: string | null }) => BackgroundWorkTarget | null
  open: (target: BackgroundWorkTarget) => void
}

// Set by the Session screen, so a background work block can open its own feed or terminal. A
// block with no link, or outside a Session, still draws the same height with no chevron.
export const BackgroundWork = createContext<BackgroundWorkLinks | null>(null)

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type Actor = DelegationRow['actor']
// A Subagent settles as `done`; a shell command keeps the CLI's own word for how it ended.
export type WorkState = ShellState | 'done'

function isShellState(status: string): status is ShellState {
  return (SHELL_STATES as readonly string[]).includes(status)
}

// The linked work is the live answer; the row's own status is what the notification said then.
function workState(actor: Actor, status: string | null, target: BackgroundWorkTarget | null) {
  if (target?.kind === 'shell') return target.command.state
  if (target?.kind === 'delegation') return target.delegation.landed ? 'done' : 'running'
  if (status === null) return null
  if (actor === 'agent' && status === 'completed') return 'done'
  return isShellState(status) ? status : null
}

export type BackgroundWorkBlock = {
  target: BackgroundWorkTarget | null
  status: string | null
  state: WorkState | null
  title: string | null
  // Only the newest line: the linked feed or terminal holds the rest.
  line: string | null
  lineIsCommand: boolean
}

export function backgroundWorkBlock(
  actor: Actor,
  latest: DelegationRow | undefined,
  links: BackgroundWorkLinks | null,
): BackgroundWorkBlock {
  const target =
    links?.find({ callId: latest?.callId ?? null, name: latest?.action ?? null }) ?? null
  const status = latest?.status ?? null
  const command = target?.kind === 'shell' ? target.command.command : null
  const delegationLabel = target?.kind === 'delegation' ? target.delegation.label : null
  const title = latest?.action ?? delegationLabel ?? command
  const line = latest?.progress ?? (title === command ? null : command)
  return {
    target,
    status,
    state: workState(actor, status, target),
    title,
    line,
    lineIsCommand: line !== null && line === command,
  }
}
