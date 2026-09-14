// Session roster rows the Sessions stories draw.
import type {
  SessionDelegation,
  SessionRosterRow,
  SessionShellCommand,
} from '@/core/sessions/models'

export function sessionShellCommand(
  overrides: Partial<SessionShellCommand> & Pick<SessionShellCommand, 'id'>,
): SessionShellCommand {
  return {
    command: null,
    background: false,
    state: 'running',
    startedAt: null,
    endedAt: null,
    outputPath: null,
    result: null,
    ...overrides,
  }
}

export function sessionDelegation(
  overrides: Partial<SessionDelegation> & Pick<SessionDelegation, 'id'>,
): SessionDelegation {
  return { label: null, landed: false, startedAt: null, endedAt: null, ...overrides }
}

export function sessionRosterRow(
  overrides: Partial<SessionRosterRow> &
    Pick<SessionRosterRow, 'id' | 'cwd' | 'posture' | 'status' | 'title'>,
): SessionRosterRow {
  return {
    retiredIds: [],
    cli: 'claude',
    entry: 'interactive',
    branch: 'main',
    updatedAt: null,
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: null,
    activity: null,
    plan: null,
    delegations: [],
    shell: [],
    pullRequest: null,
    archived: false,
    setup: { model: null, effort: null, mode: null },
    ...overrides,
  }
}
