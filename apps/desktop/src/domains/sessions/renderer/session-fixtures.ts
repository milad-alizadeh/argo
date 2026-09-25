// Session roster rows the Sessions stories draw.
import type {
  SessionRosterRow,
  SessionShellCommand,
  SessionSubagent,
} from '@/domains/sessions/renderer/model/models'

function rosterRow(overrides: Partial<SessionRosterRow> = {}): SessionRosterRow {
  return {
    id: 'session-one',
    retiredIds: [],
    harness: 'claude',
    posture: 'live',
    title: null,
    status: 'idle',
    entry: 'interactive',
    cwd: null,
    branch: null,
    updatedAt: null,
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: null,
    activity: null,
    plan: null,
    subagents: [],
    shell: [],
    pullRequest: null,
    ticket: null,
    archived: false,
    unread: false,
    turnConfiguration: { model: null, effort: null, mode: null },
    ...overrides,
  }
}

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
