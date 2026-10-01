import { z } from 'zod'
import { ACP_HARNESSES } from './acp/acp-agents'

export const HARNESSES = ['claude', 'codex', ...ACP_HARNESSES] as const
export const harnessSchema = z.enum(HARNESSES)
export type Harness = z.infer<typeof harnessSchema>

// A Session named by its Harness's own ID, and the one map key built from it.
export type HarnessSession = { harness: Harness; nativeId: string }
export const harnessSessionKey = ({ harness, nativeId }: HarnessSession) =>
  `${harness}\u0000${nativeId}`

// What a surface shows before anyone has picked a Harness.
export const DEFAULT_HARNESS: Harness = HARNESSES[0]

// The Roster stores an open `harness` string (ADR-0021); an unknown one reads as the default.
export function harnessOrDefault(value: string | null | undefined): Harness {
  const parsed = harnessSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_HARNESS
}
