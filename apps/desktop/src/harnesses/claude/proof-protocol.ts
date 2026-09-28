// Set by the packaged acceptance driver so a proof reads an isolated fixture tree instead of the
// machine's own Sessions.
export const SESSION_CLAUDE_TRANSCRIPTS_ENV = 'ARGO_CLAUDE_TRANSCRIPTS'

// The `claude` a Session proof drives: a fake that writes transcripts, honoured only on a proof run.
export const SESSION_CLAUDE_EXECUTABLE_ENV = 'ARGO_CLAUDE_EXECUTABLE'

// The CLI a readiness probe or sign-in driver spawns on a proof run; unset means the real one on
// login PATH, exactly as an ordinary launch finds it.
export const HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV = 'ARGO_HARNESS_CLAUDE_EXECUTABLE'

// A packaged proof can supply recorded SDK-shaped rows to the sync adapter.
export const SESSION_CLAUDE_SYNC_FIXTURE_ENV = 'ARGO_CLAUDE_SYNC_FIXTURE'
