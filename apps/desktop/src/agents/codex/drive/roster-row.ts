import type { SessionRosterRow } from '@/core/sessions/models'

// A managed Codex Session as the Roster shows it before its rollout says more.
export function rosterRow(
  id: string,
  session: { cwd: string; prompt: string; failed: boolean },
): SessionRosterRow {
  return {
    id,
    retiredIds: [],
    cli: 'codex',
    posture: 'managed',
    title: { text: session.prompt, source: 'first-prompt' },
    status: session.failed ? 'unknown' : 'running',
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
