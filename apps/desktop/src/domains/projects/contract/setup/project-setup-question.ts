import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const projectSetupQuestionSchema = z
  .strictObject({
    id: identifierSchema,
    prompt: z.string().min(1),
    context: z.string().min(1).optional(),
    suggestions: z.array(z.string().min(1)).min(2),
    recommended: z.string().min(1),
  })
  .refine(({ recommended, suggestions }) => suggestions.includes(recommended), {
    message: 'The recommended answer must appear in suggestions.',
    path: ['recommended'],
  })

export const projectSetupAnswerSchema = z
  .strictObject({
    id: identifierSchema,
    selections: z.array(z.string().min(1)),
    custom: z.string(),
  })
  .refine(({ custom, selections }) => selections.length > 0 || custom.trim().length > 0)

export type ProjectSetupQuestion = z.infer<typeof projectSetupQuestionSchema>
export type ProjectSetupAnswer = z.infer<typeof projectSetupAnswerSchema>
