import { type Harness, harnessOrDefault, harnessSchema } from '@/harnesses/harness'

export const SESSION_HARNESSES = harnessSchema.options
export type SessionHarness = Harness

// Only a Session not yet started can change the harness it runs on.
export type HarnessControl = {
  harness: SessionHarness
  onChange?: (harness: SessionHarness) => void
}

export function sessionHarnessOf(session: { harness: string } | null): SessionHarness {
  return harnessOrDefault(session?.harness)
}
