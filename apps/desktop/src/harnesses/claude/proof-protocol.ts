// The folder the Claude SDK and CLI read their config and history from; unset means `~/.claude`.
export const CLAUDE_HOME_ENV = 'CLAUDE_CONFIG_DIR'

// The `claude` a Session proof drives: a mock that writes transcripts, set only by e2e.
export const SESSION_CLAUDE_EXECUTABLE_ENV = 'ARGO_CLAUDE_EXECUTABLE'

// The CLI a readiness probe or sign-in driver spawns, read on every launch and set only by e2e;
// unset means the real one on login PATH.
export const HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV = 'ARGO_HARNESS_CLAUDE_EXECUTABLE'

// A packaged proof can supply recorded SDK-shaped rows to the sync adapter.
export const SESSION_CLAUDE_SYNC_FIXTURE_ENV = 'ARGO_CLAUDE_SYNC_FIXTURE'
