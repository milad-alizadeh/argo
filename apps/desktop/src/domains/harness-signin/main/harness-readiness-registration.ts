// A Harness's readiness seam: one probe and one sign-in driver, kept apart from
// harness-registration.ts's Session-drive seam since a person can check or fix sign-in before any
// Project or Session exists (#2579). Every Harness adapter registers one of these.
import type { Harness, HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import type { HarnessSignInDriver } from './harness-sign-in'

export type HarnessReadinessRegistration = {
  readonly harness: Harness
  checkReadiness(): Promise<HarnessReadiness>
  readonly signIn: HarnessSignInDriver
}
