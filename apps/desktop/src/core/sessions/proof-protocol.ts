// Where the shipped main process looks for Claude transcripts. Set by the packaged acceptance
// driver so a proof reads an isolated fixture tree instead of the machine's own Sessions.
export const SESSION_CLAUDE_TRANSCRIPTS_ENV = 'ARGO_CLAUDE_TRANSCRIPTS'
export const SESSION_CODEX_TRANSCRIPTS_ENV = 'ARGO_CODEX_TRANSCRIPTS'

// Where the shipped main process looks for the Claude desktop app's own Session store, the one
// that says which Sessions the reader archived. Same reason as the line above: a proof reads a
// fixture store, never the reader's.
export const SESSION_CLAUDE_ARCHIVE_ENV = 'ARGO_CLAUDE_ARCHIVE'

// The `claude` a Session proof drives: a fake that writes transcripts, honoured only on a proof run.
export const SESSION_CLAUDE_EXECUTABLE_ENV = 'ARGO_CLAUDE_EXECUTABLE'
export const SESSION_CODEX_EXECUTABLE_ENV = 'ARGO_CODEX_EXECUTABLE'
