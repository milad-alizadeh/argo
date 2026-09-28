import { z } from 'zod'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { Question, QuestionAnswer } from '@/domains/sessions/api/questions'
import type { RequestID, WireMessage } from '../app-server/codex-app-server-client'

const requestBase = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
})
const approvalSchema = requestBase.extend({
  approvalId: z.string().min(1).nullable().optional(),
  command: z.string().optional(),
  reason: z.string().nullable().optional(),
})
const questionSchema = z.object({
  id: z.string().min(1),
  header: z.string().nullable().optional(),
  question: z.string().min(1),
  isSecret: z.boolean().optional(),
  options: z
    .array(z.object({ label: z.string().min(1), description: z.string().nullable().optional() }))
    .nullable(),
})
const questionsSchema = requestBase.extend({ questions: z.array(questionSchema).min(1) })

export type CodexApproval = {
  kind: 'permission'
  requestId: RequestID
  publicRequestId: string
  itemId: string
  threadId: string
  turnId: string
  description: string
  similarityKey: string
}
export type CodexQuestion = {
  kind: 'question'
  requestId: RequestID
  itemId: string
  threadId: string
  turnId: string
  answerIds: string[]
  questions: Question[]
}
export type CodexInteraction = CodexApproval | CodexQuestion

export function readCodexInteraction(message: WireMessage): CodexInteraction | null {
  if (!('method' in message) || message.id === undefined) return null
  switch (message.method) {
    case 'item/commandExecution/requestApproval':
    case 'item/fileChange/requestApproval': {
      const parsed = approvalSchema.parse(message.params)
      return {
        kind: 'permission',
        requestId: message.id,
        publicRequestId: parsed.approvalId ?? parsed.itemId,
        itemId: parsed.itemId,
        threadId: parsed.threadId,
        turnId: parsed.turnId,
        description: parsed.command ?? parsed.reason ?? 'Approve this file change?',
        similarityKey: `${message.method}:${parsed.command ?? parsed.reason ?? parsed.itemId}`,
      }
    }
    case 'item/tool/requestUserInput': {
      const parsed = questionsSchema.parse(message.params)
      return {
        kind: 'question',
        requestId: message.id,
        itemId: parsed.itemId,
        threadId: parsed.threadId,
        turnId: parsed.turnId,
        answerIds: parsed.questions.map(({ id }) => id),
        questions: parsed.questions.map(({ question, header, options }) => ({
          question,
          header: header ?? null,
          multiSelect: false,
          options: (options ?? []).map(({ label, description }) => ({
            label,
            description: description ?? null,
          })),
        })),
      }
    }
    default:
      return null
  }
}

export function approvalResponse(decision: PermissionDecision): { decision: string } {
  switch (decision) {
    case 'allow':
      return { decision: 'accept' }
    case 'allowForSession':
      return { decision: 'accept' }
    case 'deny':
      return { decision: 'decline' }
    case 'cancel':
      return { decision: 'decline' }
  }
}

export function questionResponse(pending: CodexQuestion, answers: QuestionAnswer[]) {
  const mapped: Record<string, { answers: string[] }> = {}
  pending.answerIds.forEach((id, position) => {
    const answer = answers[position]
    const question = pending.questions[position]
    if (answer === undefined || question === undefined) return
    mapped[id] = {
      answers:
        answer.kind === 'text'
          ? [answer.text]
          : answer.indices.flatMap((index) => {
              const option = question.options[index - 1]
              return option === undefined ? [] : [option.label]
            }),
    }
  })
  return { answers: mapped }
}
