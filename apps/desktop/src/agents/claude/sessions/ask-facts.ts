import { questionSchema } from '@/domains/sessions/contract/drive/question'
import type { AskFacts } from '@/domains/sessions/contract/model/transcript'

const ASK_TOOL = 'AskUserQuestion'

// Claude's `AskUserQuestion` input carries the structured questions verbatim.
export function askFacts(name: string, input: Record<string, unknown>): AskFacts | null {
  if (name !== ASK_TOOL || !Array.isArray(input.questions)) return null
  const questions = input.questions.map((question) => questionSchema.safeParse(question))
  if (questions.length === 0 || questions.some((question) => !question.success)) return null
  return {
    kind: 'ask',
    questions: questions.flatMap((question) => (question.success ? [question.data] : [])),
    unsupported: null,
  }
}
