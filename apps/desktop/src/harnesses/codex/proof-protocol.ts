// The `codex` a Session proof drives, honoured only on a proof run.
export const SESSION_CODEX_EXECUTABLE_ENV = 'ARGO_CODEX_EXECUTABLE'

// The CLI a readiness probe or sign-in driver spawns, read on every launch and set only by e2e;
// unset means the real one on login PATH.
export const HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV = 'ARGO_HARNESS_CODEX_EXECUTABLE'
