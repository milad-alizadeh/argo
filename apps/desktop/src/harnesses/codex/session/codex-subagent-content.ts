import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'

type SubagentItem = Extract<ThreadItem, { type: 'subAgentActivity' }>

const activityStatuses = {
  started: 'running',
  interacted: 'running',
  interrupted: 'interrupted',
  completed: 'completed',
} as const satisfies Record<
  SubagentItem['kind'],
  Extract<FeedContent, { kind: 'delegation' }>['status']
>

// Every activity of one Subagent carries its thread id, so its Feed row updates in place.
export function codexSubagentContent(item: SubagentItem): FeedContent {
  const name = item.agentPath.split('/').filter(Boolean).at(-1) ?? null
  return {
    kind: 'delegation',
    id: item.agentThreadId,
    agentId: item.agentThreadId,
    status: activityStatuses[item.kind],
    name,
    prompt: null,
    model: null,
    summary: null,
  }
}
