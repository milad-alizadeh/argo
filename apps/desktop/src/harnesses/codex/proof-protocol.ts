// Set by the packaged acceptance driver so a proof reads an isolated fixture tree instead of the
// machine's own Sessions.
export const SESSION_CODEX_TRANSCRIPTS_ENV = 'ARGO_CODEX_TRANSCRIPTS'

// The `codex` a Session proof drives, honoured only on a proof run.
export const SESSION_CODEX_EXECUTABLE_ENV = 'ARGO_CODEX_EXECUTABLE'

// The CLI a readiness probe or sign-in driver spawns on a proof run; unset means the real one on
// login PATH, exactly as an ordinary launch finds it.
export const HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV = 'ARGO_HARNESS_CODEX_EXECUTABLE'
