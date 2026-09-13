import type { SessionRosterRow } from '@/core/sessions/models'

// The Roster row for a Session whose `claude` Argo is running right now.
export function managedRow(id: string, session: { cwd: string; prompt: string }): SessionRosterRow {
  return {
    id,
    retiredIds: [],
    cli: 'claude',
    posture: 'managed',
    title: { text: session.prompt, source: 'first-prompt' },
    status: 'running',
    entry: 'interactive',
    cwd: session.cwd,
    branch: null,
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
    contextTokens: null,
    spentTokens: null,
  }
}
