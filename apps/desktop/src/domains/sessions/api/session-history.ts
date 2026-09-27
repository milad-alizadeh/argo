import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import type { FeedContent } from './feed-content'

export const sessionHistoryRowSchema = z.strictObject({
  shape: z.literal('prose'),
  id: identifierSchema,
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})

export type SessionHistoryRow = z.infer<typeof sessionHistoryRowSchema>

export function projectSessionHistoryRows(content: readonly FeedContent[]): SessionHistoryRow[] {
  return content.flatMap((item) =>
    item.kind === 'message' && item.role !== 'system'
      ? [{ shape: 'prose' as const, id: item.id, role: item.role, text: item.text }]
      : [],
  )
}

export type SessionHistoryTarget = {
  nativeId: string
  subagentId: string | null
  cwd: string | null
}
