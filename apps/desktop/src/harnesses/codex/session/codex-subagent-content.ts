import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'

type SubagentItem = Extract<ThreadItem, { type: 'subAgentActivity' }>
const subagentActivitySchema = z
  .object({
    type: z.literal('subAgentActivity'),
    id: z.string().min(1),
    kind: z.enum(['started', 'interacted', 'interrupted', 'completed']),
    agentThreadId: z.string().min(1),
    agentPath: z.string(),
  })
  .passthrough() satisfies z.ZodType<SubagentItem>

const activityStatuses = {
  started: 'running',
  interacted: 'running',
  interrupted: 'interrupted',
  completed: 'completed',
} as const

// Every activity of one Subagent carries its thread id, so its Feed row updates in place.
export function codexSubagentContent(raw: unknown): FeedContent | null {
  const parsed = subagentActivitySchema.safeParse(raw)
  if (!parsed.success) return null
  const name = parsed.data.agentPath.split('/').filter(Boolean).at(-1) ?? null
  return {
    kind: 'delegation',
    id: parsed.data.agentThreadId,
    agentId: parsed.data.agentThreadId,
    status: activityStatuses[parsed.data.kind],
    name,
    prompt: null,
    model: null,
    summary: null,
  }
}
