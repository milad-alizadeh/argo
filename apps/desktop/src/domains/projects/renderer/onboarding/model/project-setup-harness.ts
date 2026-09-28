import { type Harness, harnessSchema } from '@/harnesses/harness'

export type ProjectSetupHarness = Harness

export type ProjectSetupHarnessAvailability = {
  harness: ProjectSetupHarness
  unavailableReason: string | null
}

// Before the setup snapshot reports availability, only the first registered Harness is offered.
export const defaultProjectSetupHarnesses: ProjectSetupHarnessAvailability[] =
  harnessSchema.options.map((harness, index) => ({
    harness,
    unavailableReason: index === 0 ? null : 'unavailable',
  }))
