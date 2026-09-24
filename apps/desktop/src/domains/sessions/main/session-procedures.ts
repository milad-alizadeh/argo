import { initTRPC } from '@trpc/server'
import type { SessionRuntime } from './live/session-runtime'
import { sessionAcceptedOutputSchema, sessionSubmitInputSchema } from '../contract/session-start'

const t = initTRPC.create()

export function sessionSubmitProcedure(runtime: SessionRuntime) {
  return t.procedure
    .input(sessionSubmitInputSchema)
    .output(sessionAcceptedOutputSchema)
    .mutation(({ input }) => runtime.submit(input))
}
