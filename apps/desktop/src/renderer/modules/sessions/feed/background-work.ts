import { createContext } from 'react'
import { SHELL_STATES, type ShellState } from '@/core/sessions/models'
import { delegationState, type SessionWork, type WorkState } from '../components/session-work'
import type { SessionFeedRow } from '../types'

export type BackgroundWorkLinks = {
  // By the call a notification names, or else by the name an agent was given when it was sent.
  find: (work: { callId: string | null; name: string | null }) => SessionWork | null
  open: (target: SessionWork) => void
}

// Set by the Session screen, so a background work block can open its own feed or terminal. A
// block with no link, or outside a Session, still draws the same height with no chevron.
export const BackgroundWork = createContext<BackgroundWorkLinks | null>(null)

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>
type Actor = DelegationRow['actor']
function isShellState(status: string): status is ShellState {
  return (SHELL_STATES as readonly string[]).includes(status)
}

// The linked work is the live answer; the row's own status is what the notification said then.
function workState(
  actor: Actor,
  status: string | null,
  target: SessionWork | null,
): WorkState | null {
  if (target?.kind === 'shell') return target.command.state
  if (target?.kind === 'delegation') return delegationState(target.delegation)
  if (status === null) return null
  if (actor === 'agent' && status === 'completed') return 'done'
  return isShellState(status) ? status : null
}

export type BackgroundWorkBlock = {
  target: SessionWork | null
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
