import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { ClaudeSessionSnapshot } from './claude-session-projection'

export function rosterFrom(snapshot: ClaudeSessionSnapshot): SessionRosterRow | null {
  const session = snapshot.context.session
  if (session === null) return null
  return {
    id: session.nativeId,
    retiredIds: [],
    harness: 'claude',
    posture: 'managed',
    title: { text: snapshot.context.prompt, source: 'first-prompt' },
    status: snapshot.value === 'Managed' ? 'running' : 'idle',
    entry: 'interactive',
    cwd: snapshot.context.cwd,
    branch: null,
    updatedAt: snapshot.context.startedAt,
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
    unread: false,
    contextTokens: null,
    contextWindowTokens: null,
    spentTokens: null,
    handoffTo: null,
    handoffFrom: null,
    setup: { model: null, effort: null, mode: null },
  }
}
