// A Subagent and a background Shell are different things the Harness records, and the reader picks
// between them in the same shape: a name, a state, and the two facts (#1582). Flattening both into
// one entry here keeps the menu from branching on which kind it is drawing.
import type { TFunction } from 'i18next'
import type { SessionShellCommand, SessionSubagent } from '../types'
import {
  elapsedDuration,
  subagentWorkState,
  WORK_STATE_MARKS,
  workPresentation,
} from './presentation'
import type { SubagentUsageFacts } from './types'

export type WorkEntry = {
  id: string
  title: string
  // Raw command text is read as code; a derived label, Subagent or Shell, is prose.
  monospace: boolean
  group: 'running' | 'unknown' | 'finished'
  mark: string
  state: string
  facts: string
}

function workGroup(state: ReturnType<typeof subagentWorkState>): WorkEntry['group'] {
  switch (state) {
    case 'running':
      return 'running'
    case 'unknown':
      return 'unknown'
    case 'done':
    case 'completed':
    case 'failed':
    case 'interrupted':
      return 'finished'
  }
}

export function delegationEntries(
  subagents: readonly SessionSubagent[],
  { now, usage }: { now: number; usage: Readonly<Record<string, SubagentUsageFacts>> },
  t: TFunction<'sessions'>,
): WorkEntry[] {
  return subagents.map((delegation) => {
    const state = subagentWorkState(delegation)
    const presentation = workPresentation(
      {
        kind: 'subagent',
        id: delegation.id,
        name: delegation.label,
        state,
        model: usage[delegation.id]?.model ?? null,
        durationMs: elapsedDuration(delegation.startedAt ?? null, delegation.endedAt ?? null, now),
        tokens: usage[delegation.id]?.tokens ?? null,
      },
      t,
    )
    return {
      id: delegation.id,
      ...presentation,
      monospace: false,
      group: workGroup(state),
      mark: WORK_STATE_MARKS[state],
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
    ...workPresentation({ kind: 'shell', ...command, now }, t),
    monospace: command.label === null,
    group: command.state === 'running' ? 'running' : 'finished',
    mark: WORK_STATE_MARKS[command.state],
  }))
}
