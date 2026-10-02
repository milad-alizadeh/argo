import { z } from 'zod'
import { type Question, questionSchema } from '@/domains/sessions/api/questions'

export const ASK_USER_QUESTION_TOOL = 'AskUserQuestion'

const askInputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        header: z.string().nullable(),
        multiSelect: z.boolean(),
        options: z.array(
          z.object({
            label: z.string().min(1),
            description: z.string().nullable(),
          }),
        ),
      }),
    )
    .min(1),
})

// The Questions an AskUserQuestion input asks, live or recorded, or null for any other shape.
export function readAskedQuestions(input: unknown): Question[] | null {
  const parsed = askInputSchema.safeParse(input)
  if (!parsed.success) return null
  return parsed.data.questions.map((question) => questionSchema.parse(question))
}
