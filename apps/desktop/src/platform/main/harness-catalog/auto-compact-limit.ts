import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import type { HarnessRegistration } from '@/harnesses/registration'

const t = initTRPC.create()
const limitSchema = z.number().int().positive()

export type AutoCompactLimitLookup = (harness: Harness) => HarnessRegistration['autoCompactLimit']

function autoCompactLimitOf(lookup: AutoCompactLimitLookup, harness: Harness) {
  const capability = lookup(harness)
  if (capability === undefined)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This Harness has no auto-compact limit to change.',
    })
  return capability
}

export function autoCompactLimitReadProcedure(lookup: AutoCompactLimitLookup) {
  return t.procedure
    .input(z.strictObject({ harness: harnessSchema }))
    .output(limitSchema.nullable())
    .query(({ input }) => autoCompactLimitOf(lookup, input.harness).read())
}

export function autoCompactLimitWriteProcedure(lookup: AutoCompactLimitLookup) {
  return t.procedure
    .input(z.strictObject({ harness: harnessSchema, limit: limitSchema }))
    .output(limitSchema.nullable())
    .mutation(({ input }) => autoCompactLimitOf(lookup, input.harness).write(input.limit))
}
