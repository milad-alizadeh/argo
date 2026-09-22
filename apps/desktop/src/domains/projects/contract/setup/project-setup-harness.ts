export const projectSetupHarnesses = ['claude', 'codex'] as const
export type ProjectSetupHarness = (typeof projectSetupHarnesses)[number]

export type ProjectSetupHarnessAvailability = {
  harness: ProjectSetupHarness
  unavailableReason: string | null
}

export const defaultProjectSetupHarnesses = [
  { harness: 'claude', unavailableReason: null },
  { harness: 'codex', unavailableReason: 'unavailable' },
] as const satisfies ProjectSetupHarnessAvailability[]
