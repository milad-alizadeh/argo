import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { PERMISSION_DECISIONS } from '@/domains/sessions/api/permissions'
import { questionAnswerSchema } from '@/domains/sessions/api/questions'
import { identifierSchema } from '@/shared/validation'
import type { LiveSessionSupervisorActor } from '../live/live-session-supervisor-machine'
import type { SessionInteractionBroker } from '../live/session-interaction-broker'

const t = initTRPC.create()
const sessionInput = z.strictObject({ sessionId: identifierSchema })
const permissionInput = sessionInput.extend({
  permissionId: identifierSchema,
  decision: z.enum(PERMISSION_DECISIONS),
})
const questionInput = sessionInput.extend({
  questionId: identifierSchema,
  answers: z.array(questionAnswerSchema),
})

export type SessionInteractionContext = {
  database: Database
  interactions: SessionInteractionBroker
  supervisor: LiveSessionSupervisorActor
}

function sessionIdentityOf(context: SessionInteractionContext, sessionId: string) {
  const row = context.database
    .select({ nativeId: sessionTable.nativeId, harness: sessionTable.harness })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (row === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  return row
}

async function decidePermission(
  context: SessionInteractionContext,
  input: z.infer<typeof permissionInput>,
): Promise<boolean> {
  sessionIdentityOf(context, input.sessionId)
  return new Promise<boolean>((resolve, reject) =>
    context.supervisor.send({
      type: 'Answer permission',
      sessionId: input.sessionId,
      requestId: input.permissionId,
      decision: input.decision,
      reply: { resolve, reject },
    }),
  )
}

async function decideQuestion(
  context: SessionInteractionContext,
  input: z.infer<typeof questionInput>,
): Promise<boolean> {
  sessionIdentityOf(context, input.sessionId)
  return new Promise<boolean>((resolve, reject) =>
    context.supervisor.send({
      type: 'Answer question',
      sessionId: input.sessionId,
      requestId: input.questionId,
      answers: input.answers,
      reply: { resolve, reject },
    }),
  )
}

export function sessionInteractionProcedures(context: SessionInteractionContext) {
  return {
    sessionInterrupt: t.procedure.input(sessionInput).mutation(
      ({ input }) =>
        new Promise<{ accepted: true }>((resolve, reject) => {
          context.supervisor.send({
            type: 'Interrupt',
            sessionId: input.sessionId,
            reply: {
              resolve: () => resolve({ accepted: true }),
              reject,
            },
          })
        }),
    ),
    sessionPermissionRead: t.procedure.input(sessionInput).query(({ input }) => {
      const pending = context.interactions.permission(
        sessionIdentityOf(context, input.sessionId).nativeId,
      )
      return pending === null
        ? null
        : {
            id: pending.requestId,
            sessionId: input.sessionId,
            description: pending.description,
          }
    }),
    sessionPermissionDecide: t.procedure.input(permissionInput).mutation(async ({ input }) => {
      const accepted = await decidePermission(context, input)
      if (!accepted) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-permission' })
      return { accepted: true }
    }),
    sessionQuestionDecide: t.procedure.input(questionInput).mutation(async ({ input }) => {
      const accepted = await decideQuestion(context, input)
      if (!accepted) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-question' })
      return { accepted: true }
    }),
  }
}
