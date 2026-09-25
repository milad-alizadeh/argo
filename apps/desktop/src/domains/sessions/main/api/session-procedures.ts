import { initTRPC } from '@trpc/server'
import type { SessionSupervisorActor } from '../live/session-supervisor-machine'
import { sessionAcceptedOutputSchema, sessionSubmitInputSchema } from './session-start'

const t = initTRPC.create()

export function sessionSubmitProcedure(supervisor: SessionSupervisorActor) {
  return t.procedure
    .input(sessionSubmitInputSchema)
    .output(sessionAcceptedOutputSchema)
    .mutation(
      ({ input }) =>
        new Promise<{ sessionId: string }>((resolve, reject) => {
          const reply = { resolve, reject }
          if (input.sessionId === null) {
            if (input.pendingId === null)
              throw new Error('A new Session requires its pending identity.')
            supervisor.send({ type: 'Start', input, pendingId: input.pendingId, reply })
          } else
            supervisor.send({
              type: 'Send',
              input: { ...input, sessionId: input.sessionId },
              reply,
            })
        }),
    )
}
