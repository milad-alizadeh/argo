import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { claudeQuestionAnswerSchema } from './claude-contract'

// A pending question is answered rather than read: it already reaches the renderer through the
// Feed's own `ask` row (tool-feed.ts), sourced off the same transcript every posture reads. There
// is no `session.question` read op because there is nothing left for one to say.
export const sessionQuestionDecisionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.question.decide'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  // The `AskUserQuestion` tool call id the Feed's `ask` row carries, so a decision cannot answer
  // a question this Session has already moved past.
  questionId: identifierSchema,
  answers: z.array(claudeQuestionAnswerSchema).min(1),
})
export type SessionQuestionDecisionRequest = z.infer<typeof sessionQuestionDecisionRequestSchema>
