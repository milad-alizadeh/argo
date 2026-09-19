// Session roster rows the Sessions stories draw.
import type { SessionRosterRow, SessionShellCommand, SessionSubagent } from '../contract/models'
import { rosterRow } from '../contract/roster-row-test-fixture'

export function sessionShellCommand(
  overrides: Partial<SessionShellCommand> & Pick<SessionShellCommand, 'id'>,
): SessionShellCommand {
  return {
    command: null,
    label: null,
    background: false,
    state: 'running',
    startedAt: null,
    endedAt: null,
    outputPath: null,
    result: null,
    ...overrides,
  }
}

export function sessionSubagent(
  overrides: Partial<SessionSubagent> & Pick<SessionSubagent, 'id'>,
): SessionSubagent {
  return { label: null, state: 'running', startedAt: null, endedAt: null, ...overrides }
}

export function sessionRosterRow(
  overrides: Partial<SessionRosterRow> &
    Pick<SessionRosterRow, 'id' | 'cwd' | 'posture' | 'status' | 'title'>,
): SessionRosterRow {
  return rosterRow({ branch: 'main', ...overrides })
}
