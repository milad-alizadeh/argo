import { z } from 'zod'

export const sessionDiscoveryJobSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('claude-session-discovery'),
    harness: z.literal('claude'),
  }),
  z.strictObject({
    kind: z.literal('codex-session-discovery'),
    harness: z.literal('codex'),
  }),
])

export type SessionDiscoveryJob = z.infer<typeof sessionDiscoveryJobSchema>
export type SessionDiscoveryJobFor<Id extends 'claude' | 'codex'> = Extract<
  SessionDiscoveryJob,
  { harness: Id }
>
