import type { SessionRosterRow } from './models'

type ManagedSessionFacts = Pick<SessionRosterRow, 'id' | 'cli' | 'cwd' | 'status'> & {
  prompt: string
  startedAt: string
}

// A Session Argo started, listed from what its driver holds before the CLI writes a transcript.
export function managedRosterRow(session: ManagedSessionFacts): SessionRosterRow {
  return {
    id: session.id,
    retiredIds: [],
    cli: session.cli,
    posture: 'managed',
    title: { text: session.prompt, source: 'first-prompt' },
    status: session.status,
    entry: 'interactive',
    cwd: session.cwd,
    branch: null,
    updatedAt: session.startedAt,
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
