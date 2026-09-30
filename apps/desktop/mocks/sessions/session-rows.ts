// Session rows the Sessions stories and unit tests draw.

import type {
  Session,
  SessionExtras,
  SessionShellCommand,
  SessionSubagent,
} from '@/domains/sessions/renderer/types'
import { DEFAULT_HARNESS } from '@/harnesses/harness'

export function sessionRow(
  overrides: Partial<Session & SessionExtras> = {},
): Session & SessionExtras {
  return {
    id: 'session-one',
    harness: DEFAULT_HARNESS,
    projectId: 'project-1',
    posture: 'live',
    title: null,
    name: 'session-one',
    status: 'idle',
    cwd: null,
    workspaceId: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    activity: null,
    subagents: [],
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
  return { label: null, state: 'running', ...overrides }
}
