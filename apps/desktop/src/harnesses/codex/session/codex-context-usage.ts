import { z } from 'zod'
import type { ContextUsage } from '@/domains/sessions/api/context-usage'
import type { ThreadTokenUsageUpdatedNotification } from '../app-server'

type UsageNotice = {
  threadId: ThreadTokenUsageUpdatedNotification['threadId']
  turnId: ThreadTokenUsageUpdatedNotification['turnId']
  tokenUsage: {
    last: Pick<ThreadTokenUsageUpdatedNotification['tokenUsage']['last'], 'totalTokens'>
    modelContextWindow: ThreadTokenUsageUpdatedNotification['tokenUsage']['modelContextWindow']
  }
}

const tokenUsageNotificationSchema: z.ZodType<UsageNotice> = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  tokenUsage: z.object({
    last: z.object({ totalTokens: z.number().int().nonnegative() }),
    modelContextWindow: z.number().int().positive().nullable(),
  }),
})

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
