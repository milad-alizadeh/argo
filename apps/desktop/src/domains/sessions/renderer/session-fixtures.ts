// Session rows the Sessions stories draw.
import type {
  SessionRow,
  SessionShellCommand,
  SessionSubagent,
} from '@/domains/sessions/renderer/model/models'

function listedSession(overrides: Partial<SessionRow> = {}): SessionRow {
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

export function sessionRow(
  overrides: Partial<SessionRow> & Pick<SessionRow, 'id' | 'cwd' | 'posture' | 'status' | 'title'>,
): SessionRow {
  return listedSession({ branch: 'main', ...overrides })
}
