// Where the shipped main process looks for Claude transcripts. Set by the packaged acceptance
// driver so a proof reads an isolated fixture tree instead of the machine's own Sessions.
export const SESSION_CLAUDE_TRANSCRIPTS_ENV = 'ARGO_CLAUDE_TRANSCRIPTS'
export const SESSION_CODEX_TRANSCRIPTS_ENV = 'ARGO_CODEX_TRANSCRIPTS'
