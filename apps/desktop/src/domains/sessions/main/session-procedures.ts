import { initTRPC } from '@trpc/server'
import { sessionAcceptedOutputSchema, sessionSubmitInputSchema } from '../contract/session-start'
import type { SessionSupervisorActor } from './live/session-supervisor-machine'

const t = initTRPC.create()

export function sessionSubmitProcedure(supervisor: SessionSupervisorActor) {
  return t.procedure
    .input(sessionSubmitInputSchema)
    .output(sessionAcceptedOutputSchema)
    .mutation(
      ({ input }) =>
        new Promise<{ sessionId: string }>((resolve, reject) => {
          const reply = { resolve, reject }
          if (input.sessionId === null) supervisor.send({ type: 'Start', input, reply })
          else
            supervisor.send({
              type: 'Send',
              input: { ...input, sessionId: input.sessionId },
              reply,
            })
        }),
    )
}
