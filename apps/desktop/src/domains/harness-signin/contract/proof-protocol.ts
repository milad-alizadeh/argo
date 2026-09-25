// The Harness readiness/sign-in seam's own proof env vars (#2579), kept apart from
// `harnesses/proof-protocol.ts`'s Session-drive seam: a packaged proof can point a
// readiness probe or a sign-in driver at a mock CLI without touching what a Session drives.

// The `claude`/`codex` a readiness probe or sign-in driver spawns on a proof run; unset means the
// real one on login PATH, exactly as an ordinary launch finds it.
export const HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV = 'ARGO_HARNESS_CLAUDE_EXECUTABLE'
export const HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV = 'ARGO_HARNESS_CODEX_EXECUTABLE'

// How long a sign-in attempt outlives an unresolved `wait` before it reads as expired. Unset
// keeps the shipped default (`DEFAULT_EXPIRES_AFTER_MS` in `harness-sign-in.ts`); a proof sets it
// to 0 so the very next `wait` after `start` reads expired without a real ten-minute clock.
export const HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV = 'ARGO_HARNESS_SIGN_IN_EXPIRES_AFTER_MS'
