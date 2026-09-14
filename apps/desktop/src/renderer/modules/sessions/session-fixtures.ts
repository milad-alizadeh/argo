// Session roster rows the Sessions stories draw.
import type { SessionRosterRow } from '@/core/sessions/models'

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
    ticket: null,
    archived: false,
    setup: { model: null, effort: null, mode: null },
    ...overrides,
  }
}
