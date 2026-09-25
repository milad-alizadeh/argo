// The main-process capabilities other domains may use. Harness sign-in feature internals stay
// private: a Harness adapter registers against this seam, never the attempt machinery behind it.
export type { HarnessReadinessRegistration } from './harness-readiness-registration'
export type {
  HarnessSignInDriver,
  HarnessSignInOutcome,
} from './harness-sign-in'
export {
  createHarnessSignInProcedureContext,
  type HarnessSignInProcedureContext,
  harnessSignInProcedures,
} from './harness-sign-in-procedures'
