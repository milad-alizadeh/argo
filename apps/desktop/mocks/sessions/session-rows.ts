// Session rows the Sessions stories and unit tests draw.

import type {
  Session,
  SessionShellCommand,
  SessionSubagent,
} from '@/domains/sessions/renderer/types'
import { DEFAULT_HARNESS } from '@/harnesses/harness'

export function sessionRow(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-one',
    harness: DEFAULT_HARNESS,
    projectId: 'project-1',
    createdAt: '2026-09-30T10:00:00.000Z',
    sortOrder: 0,
    posture: 'live',
    customTitle: null,
    preview: null,
    title: null,
    status: 'idle',
    cwd: null,
    workspaceId: null,
    updatedAt: null,
    activity: null,
    plan: null,
    subagents: [],
    shell: [],
    ticket: null,
    archived: false,
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
