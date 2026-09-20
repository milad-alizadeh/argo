// Where the shipped main process looks for Claude transcripts. Set by the packaged acceptance
// driver so a proof reads an isolated fixture tree instead of the machine's own Sessions.
export const SESSION_CLAUDE_TRANSCRIPTS_ENV = 'ARGO_CLAUDE_TRANSCRIPTS'
export const SESSION_CODEX_TRANSCRIPTS_ENV = 'ARGO_CODEX_TRANSCRIPTS'

// The `claude` a Session proof drives: a fake that writes transcripts, honoured only on a proof run.
export const SESSION_CLAUDE_EXECUTABLE_ENV = 'ARGO_CLAUDE_EXECUTABLE'
export const SESSION_CODEX_EXECUTABLE_ENV = 'ARGO_CODEX_EXECUTABLE'

// The reply gap a packaged proof gives both mock CLIs. Omitted means their current, immediate
// reply behavior, so the ordinary proof cases retain their existing timing.
export const SESSION_MOCK_REPLY_DELAY_MS_ENV = 'ARGO_MOCK_REPLY_DELAY_MS'

// Opts a packaged proof into a replayable adverse transport plan; unset keeps ordinary mock behavior.
export const SESSION_MOCK_ADVERSARIAL_SEED_ENV = 'ARGO_MOCK_ADVERSARIAL_SEED'
