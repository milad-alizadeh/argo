import { type Harness, harnessSchema } from './harness'
import type { HarnessRegistration } from './registration'

export type HarnessRegistry = {
  get: (harness: Harness) => HarnessRegistration
  all: () => readonly HarnessRegistration[]
}

export function createHarnessRegistry(
  registrations: readonly HarnessRegistration[],
): HarnessRegistry {
  const byHarness = new Map<Harness, HarnessRegistration>()
  for (const registration of registrations) {
    if (byHarness.has(registration.harness))
      throw new Error(`Duplicate Harness registration: ${registration.harness}`)
    byHarness.set(registration.harness, registration)
  }
  for (const harness of harnessSchema.options) {
    if (!byHarness.has(harness)) throw new Error(`Missing Harness registration: ${harness}`)
  }
  return {
    get: (harness) => {
      const registration = byHarness.get(harness)
      if (registration === undefined) throw new Error(`Missing Harness registration: ${harness}`)
      return registration
    },
    all: () => [...byHarness.values()],
  }
}
