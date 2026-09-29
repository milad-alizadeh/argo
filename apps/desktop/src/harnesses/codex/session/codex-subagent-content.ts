import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'

type SubagentItem = Extract<ThreadItem, { type: 'subAgentActivity' }>
type CollabItem = Extract<ThreadItem, { type: 'collabAgentToolCall' }>

// What the collab call behind an activity sent: it shares the activity's item id.
export type CodexCollabFacts = Pick<CollabItem, 'prompt' | 'model'>

const activityStatuses = {
  started: 'running',
  interacted: 'running',
  interrupted: 'interrupted',
  completed: 'completed',
} as const satisfies Record<
  SubagentItem['kind'],
  Extract<FeedContent, { kind: 'delegation' }>['status']
>

const activityEvents = {
  started: 'started',
  interacted: 'messaged',
  interrupted: 'responded',
  completed: 'responded',
} as const satisfies Record<
  SubagentItem['kind'],
  Extract<FeedContent, { kind: 'delegation' }>['event']
>

// Each activity is its own item, so a later one never replaces an earlier one's row; the thread
// id names the Subagent whose Feed it opens.
export function codexSubagentContent(
  item: SubagentItem,
  call: CodexCollabFacts | undefined,
): FeedContent {
  const name = item.agentPath.split('/').filter(Boolean).at(-1) ?? null
  return {
    kind: 'delegation',
    id: item.id,
    event: activityEvents[item.kind],
    agentId: item.agentThreadId,
    status: activityStatuses[item.kind],
    name,
    prompt: call?.prompt ?? null,
    model: call?.model ?? null,
    summary: null,
  }
}

export function codexCollabFacts(items: readonly ThreadItem[]): Map<string, CodexCollabFacts> {
  return new Map(
    items.flatMap((item) =>
      item.type === 'collabAgentToolCall'
        ? [[item.id, { prompt: item.prompt, model: item.model }] as const]
        : [],
    ),
  )
}

// A live turn's activities and collab calls, paired by id whichever of the two lands first.
export class CodexSubagentPairing {
  private readonly collabById = new Map<string, CodexCollabFacts>()
  private readonly activityById = new Map<string, SubagentItem>()

  activity(item: SubagentItem): FeedContent {
    this.activityById.set(item.id, item)
    return codexSubagentContent(item, this.collabById.get(item.id))
  }

  // The activity this call completes, redrawn with what the call sent; null until it lands.
  collab(item: CollabItem): FeedContent | null {
    this.collabById.set(item.id, { prompt: item.prompt, model: item.model })
    const activity = this.activityById.get(item.id)
    return activity === undefined ? null : this.activity(activity)
  }

  clear(): void {
    this.collabById.clear()
    this.activityById.clear()
  }
}
