import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import {
  harnessReadinessListedSchema,
  harnessSignInCanceledSchema,
  harnessSignInError,
  harnessSignInErrorSchema,
  harnessSignInResolvedSchema,
  harnessSignInStartedSchema,
} from '@/domains/harness-signin/contract/contract'
import { HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV } from '@/domains/harness-signin/contract/proof-protocol'
import { harnessSchema } from '@/harnesses/harness'
import { listHarnessReadiness } from './harness-readiness-list'
import type { HarnessReadinessRegistration } from './harness-readiness-registration'
import { createHarnessSignIn } from './harness-sign-in'
import { canceledReply, resolvedReply, startedReply } from './harness-sign-in-replies'

const t = initTRPC.create()
const emptyInputSchema = z.undefined()
const harnessInputSchema = z.strictObject({ harness: harnessSchema })
const readinessOutputSchema = z.union([harnessReadinessListedSchema, harnessSignInErrorSchema])
const startedOutputSchema = z.union([harnessSignInStartedSchema, harnessSignInErrorSchema])
const resolvedOutputSchema = z.union([harnessSignInResolvedSchema, harnessSignInErrorSchema])
const canceledOutputSchema = z.union([harnessSignInCanceledSchema, harnessSignInErrorSchema])

export type HarnessSignInProcedureContext = {
  registrations: readonly HarnessReadinessRegistration[]
  signIn: ReturnType<typeof createHarnessSignIn>
}

// A proof run may shorten the sign-in window; any other value is rejected, not guessed at.
export function harnessSignInExpiresAfterMs(proofEnabled: boolean): number | undefined {
  const raw = proofEnabled ? process.env[HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV] : undefined
  if (raw === undefined) return undefined
  const parsed = z.coerce.number().int().nonnegative().safeParse(raw)
  if (parsed.success) return parsed.data
  console.error(
    `Ignored ${HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV}=${raw}: not a whole number of milliseconds.`,
  )
  return undefined
}

export function createHarnessSignInProcedureContext(
  registrations: readonly HarnessReadinessRegistration[],
  options: { expiresAfterMs?: number } = {},
): HarnessSignInProcedureContext {
  const drivers = Object.fromEntries(
    registrations.map((registration) => [registration.harness, registration.signIn]),
  ) as Parameters<typeof createHarnessSignIn>[0]
  return { registrations, signIn: createHarnessSignIn(drivers, options) }
}

export function harnessSignInProcedures(context: HarnessSignInProcedureContext) {
  return {
    harnessReadinessList: t.procedure
      .input(emptyInputSchema)
      .output(readinessOutputSchema)
      .query(() => listHarnessReadiness(context.registrations, randomUUID())),
    harnessSignInStart: t.procedure
      .input(harnessInputSchema)
      .output(startedOutputSchema)
      .mutation(({ input }) => startedReply(randomUUID(), context.signIn.start(input.harness))),
    harnessSignInWait: t.procedure
      .input(harnessInputSchema)
      .output(resolvedOutputSchema)
      .mutation(async ({ input }) => {
        const requestId = randomUUID()
        const result = await context.signIn.wait(input.harness)
        if (!result) return harnessSignInError('no-sign-in', requestId)
        return resolvedReply(requestId, result.snapshot, result.readiness)
      }),
    harnessSignInCancel: t.procedure
      .input(harnessInputSchema)
      .output(canceledOutputSchema)
      .mutation(async ({ input }) =>
        canceledReply(randomUUID(), await context.signIn.cancel(input.harness)),
      ),
  }
}
