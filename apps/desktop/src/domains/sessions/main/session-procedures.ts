import { initTRPC } from '@trpc/server'
import { sessionAcceptedOutputSchema, sessionSubmitInputSchema } from '../contract/session-start'
import type { SessionRuntime } from './live/session-runtime'

const t = initTRPC.create()

export function sessionSubmitProcedure(runtime: SessionRuntime) {
  return t.procedure
    .input(sessionSubmitInputSchema)
    .output(sessionAcceptedOutputSchema)
    .mutation(({ input }) => runtime.submit(input))
}
