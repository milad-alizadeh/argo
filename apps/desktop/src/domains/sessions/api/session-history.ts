import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const sessionHistoryRowSchema = z.strictObject({
  shape: z.literal('prose'),
  id: identifierSchema,
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

export type SessionHistoryRow = z.infer<typeof sessionHistoryRowSchema>

export type SessionHistoryTarget = {
  nativeId: string
  subagentId: string | null
  cwd: string | null
}
