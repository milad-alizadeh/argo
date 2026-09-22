import type { HarnessReadinessListed } from '@/domains/harness-signin/contract/contract'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'

export async function listHarnessReadiness(
  registrations: readonly HarnessReadinessRegistration[],
  requestId: string,
): Promise<HarnessReadinessListed> {
  const harnesses = await Promise.all(
    registrations.map((registration) => registration.checkReadiness()),
  )
  return { version: 1, type: 'harness-readiness.listed', requestId, harnesses }
}
