import { questionSchema } from '../../../domains/sessions/contract/question'
import type { ToolCall } from '../../../domains/sessions/contract/transcript'

// Claude's `AskUserQuestion` input carries the structured questions verbatim.
export function askFacts(name: string, input: Record<string, unknown>): Pick<ToolCall, 'ask'> {
  if (name !== 'AskUserQuestion' || !Array.isArray(input.questions)) return {}
  const questions = input.questions.map((question) => questionSchema.safeParse(question))
  if (questions.length === 0 || questions.some((question) => !question.success)) return {}
  return {
    ask: {
      kind: 'ask',
      questions: questions.flatMap((question) => (question.success ? [question.data] : [])),
      unsupported: null,
    },
  }
}
