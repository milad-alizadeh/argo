// A Subagent and a background Shell are different things the CLI records, and the reader picks
// between them in the same shape: a name, a state, and the two facts (#1582). Flattening both into
// one entry here keeps the menu from branching on which kind it is drawing.
import type { TFunction } from 'i18next'
import type { SubagentUsageFacts } from '../../../contract/background-work-contract'
import type { SessionShellCommand, SessionSubagent } from '../../../contract/models'
import {
  readableDelegationName,
  spentTokens,
  subagentWorkState,
  WORK_STATE_MARKS,
  workDuration,
} from './session-work'

export type WorkEntry = {
  id: string
  title: string
  // Raw command text is read as code; a derived label, Subagent or Shell, is prose.
  monospace: boolean
  running: boolean
  mark: string
  state: string
  facts: string
}

// The header list and the Feed card word the same facts the same way, one separator between each.
export function joined(facts: readonly (string | null)[]): string {
  return facts.filter((fact) => fact !== null).join(' · ')
}

export function delegationEntries(
  subagents: readonly SessionSubagent[],
  { now, usage }: { now: number; usage: Readonly<Record<string, SubagentUsageFacts>> },
  t: TFunction<'sessions'>,
): WorkEntry[] {
  return subagents.map((delegation) => {
    const state = subagentWorkState(delegation)
    return {
      id: delegation.id,
      title: delegation.label === null ? delegation.id : readableDelegationName(delegation.label),
      monospace: false,
      running: state === 'running',
      mark: WORK_STATE_MARKS[state],
      state: t(`workState.${state}`),
      facts: joined([
        usage[delegation.id]?.model ?? null,
        workDuration(delegation.startedAt, delegation.endedAt, now),
        spentTokens(usage[delegation.id]?.tokens ?? null, t),
      ]),
    }
  })
}

export function shellEntries(
  shell: readonly SessionShellCommand[],
  now: number,
  t: TFunction<'sessions'>,
): WorkEntry[] {
  return shell.map((command) => ({
    id: command.id,
    title: command.label ?? command.command ?? command.id,
    monospace: command.label === null,
    running: command.state === 'running',
    mark: WORK_STATE_MARKS[command.state],
    state: t(`workState.${command.state}`),
    facts: joined([workDuration(command.startedAt, command.endedAt, now), command.result]),
  }))
}
