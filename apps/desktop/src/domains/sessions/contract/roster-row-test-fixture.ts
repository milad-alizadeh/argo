import type { SessionRosterRow } from './models'

// A complete Roster row: a test names only what it reads.
export function rosterRow(overrides: Partial<SessionRosterRow> = {}): SessionRosterRow {
  return {
    id: 'session-one',
    retiredIds: [],
    cli: 'claude',
    posture: 'managed',
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
    setup: { model: null, effort: null, mode: null },
    ...overrides,
  }
}
