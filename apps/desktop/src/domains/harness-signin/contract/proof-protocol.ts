// The Harness sign-in seam's proof env vars that name no Harness (#2579); each Harness CLI path
// lives in that Harness adapter's `proof-protocol.ts`.

// How long a sign-in attempt outlives an unresolved `wait` before it reads as expired. Unset
// keeps the shipped default (`DEFAULT_EXPIRES_AFTER_MS` in `harness-sign-in.ts`); a proof sets it
// to 0 so the very next `wait` after `start` reads expired without a real ten-minute clock.
export const HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV = 'ARGO_HARNESS_SIGN_IN_EXPIRES_AFTER_MS'
