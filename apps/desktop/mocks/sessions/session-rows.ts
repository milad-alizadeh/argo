// Session rows the Sessions stories and unit tests draw.

import type { SessionShellCommand, SessionSubagent } from '@/domains/sessions/renderer/model/models'
import type { Session } from '@/domains/sessions/renderer/types'
import { DEFAULT_HARNESS } from '@/harnesses/harness'

function listedSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-one',
    listOrderAt: 0,
    retiredIds: [],
    harness: DEFAULT_HARNESS,
    posture: 'live',
    customTitle: null,
    preview: null,
    title: null,
    status: 'idle',
    cwd: null,
    workspaceId: null,
    branch: null,
    updatedAt: null,
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
  overrides: Partial<Session> & Pick<Session, 'id' | 'cwd' | 'posture' | 'status' | 'title'>,
): Session {
  return listedSession({ branch: 'main', ...overrides })
}
