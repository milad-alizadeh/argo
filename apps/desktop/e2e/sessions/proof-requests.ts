// Session feed requests shared by the packaged contract proof. The renderer begins with no
// document revision, so either CLI must return rows rather than an unchanged acknowledgement.
export const CLAUDE_FEED_REQUEST = {
  sessionId: 'resumeChild',
  subagentId: null,
  revision: null,
}

export const CODEX_FEED_REQUEST = {
  sessionId: 'rollout-codexChild',
  subagentId: null,
  revision: null,
}
