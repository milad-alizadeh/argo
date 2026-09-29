import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

const t = initTRPC.create()

// Current Harness registrations expose neither a shell tail nor a Subagent token read.
const shellOutputSchema = z.strictObject({ state: z.literal('absent') })
const usageSchema = z.strictObject({
  usage: z.array(
    z.strictObject({
      id: identifierSchema,
      tokens: z.number().int().nonnegative().nullable(),
      model: z.string().nullable(),
    }),
  ),
})

export function sessionWorkReadProcedures() {
  return {
    sessionShellOutput: t.procedure
      .input(z.strictObject({ sessionId: identifierSchema, shellId: identifierSchema }))
      .output(shellOutputSchema)
      .query(() => ({ state: 'absent' as const })),
    sessionSubagentUsage: t.procedure
      .input(z.strictObject({ sessionId: identifierSchema }))
      .output(usageSchema)
      .query(() => ({ usage: [] })),
  }
}
