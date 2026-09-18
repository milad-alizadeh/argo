import type { SessionFeedRow } from '../../types'
import { type BackgroundWorkLinks, backgroundWorkBlock } from '../background-work'
import { type AgentThread, phaseOfState } from './delegation-facts'

type DelegationRow = Extract<SessionFeedRow, { shape: 'delegation' }>

// A Subagent's Feed rows folded into the one shape the thread card draws. The linked work, when
// the Session screen can find it, carries the clock and the spend; the rows carry the words.
export function agentThread(
  entries: readonly DelegationRow[],
  links: BackgroundWorkLinks | null,
): { agent: AgentThread; open: (() => void) | undefined } {
  const latest = entries.at(-1)
  const { target, state, title, line } = backgroundWorkBlock('agent', latest, links)
  const work = target?.kind === 'delegation' ? target : null
  const agent: AgentThread = {
    id: latest?.id ?? 'delegation',
    name: title ?? work?.delegation.id ?? '',
    phase: phaseOfState(state),
    progress: line,
    result: line,
    startedAt: work?.delegation.startedAt ?? null,
    endedAt: work?.delegation.endedAt ?? null,
    tokens: work?.usage.tokens ?? null,
    model: work?.usage.model ?? null,
  }
  const open = links === null || target === null ? undefined : () => links.open(target)
  return { agent, open }
}
