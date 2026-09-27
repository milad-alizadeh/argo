import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { PERMISSION_DECISIONS } from '@/domains/sessions/api/permissions'
import { questionAnswerSchema } from '@/domains/sessions/api/questions'
import { identifierSchema } from '@/shared/validation'
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
}

function nativeIdOf(context: SessionInteractionContext, sessionId: string): string {
  const row = context.database
    .select({ nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (row === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  return row.nativeId
}

export function sessionInteractionProcedures(context: SessionInteractionContext) {
  return {
    sessionPermissionRead: t.procedure.input(sessionInput).query(({ input }) => {
      const pending = context.interactions.permission(nativeIdOf(context, input.sessionId))
      return pending === null
        ? null
        : {
            id: pending.requestId,
            sessionId: input.sessionId,
            description: pending.description,
          }
    }),
    sessionPermissionDecide: t.procedure.input(permissionInput).mutation(({ input }) => {
      if (
        !context.interactions.decidePermission(
          nativeIdOf(context, input.sessionId),
          input.permissionId,
          input.decision,
        )
      )
        throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-permission' })
      return { accepted: true }
    }),
    sessionQuestionDecide: t.procedure.input(questionInput).mutation(({ input }) => {
      if (
        !context.interactions.decideQuestion(
          nativeIdOf(context, input.sessionId),
          input.questionId,
          input.answers,
        )
      )
        throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-question' })
      return { accepted: true }
    }),
  }
}
