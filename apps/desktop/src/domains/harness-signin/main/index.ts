// The main-process capabilities other domains may use. Harness sign-in feature internals stay
// private: a Harness adapter registers against this seam, never the attempt machinery behind it.
export type { HarnessReadinessRegistration } from '@/domains/harness-signin/main/harness-readiness-registration'
export type {
  HarnessSignInDriver,
  HarnessSignInOutcome,
} from '@/domains/harness-signin/main/harness-sign-in'
