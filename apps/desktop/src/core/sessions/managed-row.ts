import type { SessionRosterRow } from './models'

// The row a managed Session stands on before its transcript says anything; `setup` is what Argo applied.
export function managedRow(
  id: string,
  session: Pick<SessionRosterRow, 'cli' | 'cwd' | 'status' | 'setup'> & { prompt: string },
): SessionRosterRow {
  return {
    id,
    retiredIds: [],
    cli: session.cli,
    posture: 'managed',
    title: { text: session.prompt, source: 'first-prompt' },
    status: session.status,
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
    setup: session.setup,
  }
}
