import { z } from 'zod'
import type { ContextUsage } from '@/domains/sessions/api/context-usage'
import type { ThreadTokenUsageUpdatedNotification } from '../app-server'

type TokenUsage = ThreadTokenUsageUpdatedNotification['tokenUsage']

const tokenUsageNotificationSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  tokenUsage: z.object({
    last: z.object({ totalTokens: z.number().int().nonnegative() }) satisfies z.ZodType<
      Pick<TokenUsage['last'], 'totalTokens'>
    >,
    modelContextWindow: z.number().int().positive().nullable() satisfies z.ZodType<
      TokenUsage['modelContextWindow']
    >,
  }),
}) satisfies z.ZodType<Pick<ThreadTokenUsageUpdatedNotification, 'threadId' | 'turnId'>>

// The newest model call's tokens fill the context window; `total` sums every call in the thread.
// Null rejects the shape.
export function readCodexContextUsage(
  params: unknown,
): { threadId: string; turnId: string; usage: ContextUsage } | null {
  const parsed = tokenUsageNotificationSchema.safeParse(params)
  if (!parsed.success) return null
  const { threadId, turnId, tokenUsage } = parsed.data
  return {
    threadId,
    turnId,
    usage: { usedTokens: tokenUsage.last.totalTokens, windowTokens: tokenUsage.modelContextWindow },
  }
}
