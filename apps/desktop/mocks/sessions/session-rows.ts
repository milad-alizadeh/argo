// Session rows the Sessions stories and unit tests draw.

import type {
  Session,
  SessionDetails,
  SessionExtras,
  SessionShellCommand,
  SessionSubagent,
} from '@/domains/sessions/renderer/types'
import { DEFAULT_HARNESS } from '@/harnesses/harness'

// One Session's details; a story's list reads its roster row through `listedSession`.
export function sessionRow(
  overrides: Partial<SessionDetails & SessionExtras> = {},
): SessionDetails & SessionExtras {
  return {
    id: 'session-one',
    harness: DEFAULT_HARNESS,
    projectId: 'project-1',
    posture: 'live',
    name: 'session-one',
    status: 'idle',
    cwd: null,
    worktree: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    activity: null,
    subagents: [],
    ticket: null,
    archived: false,
    turnConfiguration: { model: null, effort: null, mode: null },
    planProgress: null,
    contextUsage: null,
    ...overrides,
  }
}

// The roster row main's list read projects from a Session's details.
export function listedSession({
  projectId: _projectId,
  cwd: _cwd,
  posture: _posture,
  turnConfiguration: _turnConfiguration,
  contextUsage: _contextUsage,
  ...listed
}: SessionDetails & SessionExtras): Session & SessionExtras {
  return listed
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
