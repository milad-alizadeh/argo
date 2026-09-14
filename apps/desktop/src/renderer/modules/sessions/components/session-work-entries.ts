// A Subagent and a background Shell are different things the CLI records, and the reader picks
// between them in the same shape: a name, a state, and the two facts (#1582). Flattening both into
// one entry here keeps the menu from branching on which kind it is drawing.
import type { SessionDelegation, SessionShellCommand, ShellState } from '@/core/sessions/models'
import { compactTokens, SHELL_STATE_WORDS, workDuration } from './session-work'

export type WorkEntry = {
  id: string
  title: string
  // A command is the text the CLI was given, so it is read as code. A Subagent's label is prose.
  monospace: boolean
  running: boolean
  // The semantic ground the state mark takes, the same set the Roster draws a Session's status in.
  mark: string
  state: string
  facts: string
}

const SHELL_MARKS: Record<ShellState, string> = {
  running: 'bg-active shadow-state-glow',
  completed: 'bg-idle',
  failed: 'bg-danger',
  killed: 'bg-warn',
  stopped: 'bg-warn',
}

function joined(facts: readonly (string | null)[]): string {
  return facts.filter((fact) => fact !== null).join(' · ')
}

export function delegationEntries(
  delegations: readonly SessionDelegation[],
  tokens: Readonly<Record<string, number | null>>,
  now: number,
): WorkEntry[] {
  return delegations.map((delegation) => ({
    id: delegation.id,
    title: delegation.label ?? delegation.id,
    monospace: false,
    running: !delegation.landed,
    mark: delegation.landed ? 'bg-idle' : 'bg-active shadow-state-glow',
    state: delegation.landed ? 'Landed' : 'Running',
    facts: joined([
      workDuration(delegation.startedAt, delegation.endedAt, now),
      compactTokens(tokens[delegation.id] ?? null) === null
        ? null
        : `${compactTokens(tokens[delegation.id] ?? null)} tokens`,
    ]),
  }))
}

export function shellEntries(shell: readonly SessionShellCommand[], now: number): WorkEntry[] {
  return shell.map((command) => ({
    id: command.id,
    title: command.command ?? command.id,
    monospace: true,
    running: command.state === 'running',
    mark: SHELL_MARKS[command.state],
    state: SHELL_STATE_WORDS[command.state],
    facts: joined([workDuration(command.startedAt, command.endedAt, now), command.result]),
  }))
}
