import { z } from 'zod'

export const setupQuestionsSchema = z.array(z.strictObject({ id: z.string(), prompt: z.string() }))
export const setupProgressSchema = z.array(
  z.strictObject({
    stepId: z.string(),
    status: z.enum(['pending', 'running', 'waiting-for-user', 'passed', 'failed']),
    message: z.string(),
  }),
)
