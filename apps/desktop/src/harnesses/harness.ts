import { z } from 'zod'

export const HARNESSES = ['claude', 'codex'] as const
export const harnessSchema = z.enum(HARNESSES)
export type Harness = z.infer<typeof harnessSchema>

// What a surface shows before anyone has picked a Harness.
export const DEFAULT_HARNESS: Harness = HARNESSES[0]

// The Roster stores an open `harness` string (ADR-0021); an unknown one reads as the default.
export function harnessOrDefault(value: string | null | undefined): Harness {
  const parsed = harnessSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_HARNESS
}
