import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'
import type { ThreadReadResponse } from '../app-server/protocol-generated/v2/thread-read-response'

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
  nickname: string | null = null,
): FeedContent {
  const name = item.agentPath.split('/').filter(Boolean).at(-1) ?? null
  return {
    kind: 'delegation',
    id: item.id,
    event: activityEvents[item.kind],
    agentId: item.agentThreadId,
    status: activityStatuses[item.kind],
    name,
    ...(nickname === null ? {} : { nickname }),
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

// The nickname Codex gave each spawned thread, read once from the thread itself: no activity item
// carries it. A thread that cannot be read has none.
export class CodexSubagentNicknames {
  private readonly request: CodexRequest
  private readonly byThread = new Map<string, Promise<string | null>>()
  private readonly settled = new Map<string, string | null>()

  constructor(request: CodexRequest) {
    this.request = request
  }

  known(threadId: string): string | null {
    return this.settled.get(threadId) ?? null
  }

  read(threadId: string): Promise<string | null> {
    const existing = this.byThread.get(threadId)
    if (existing !== undefined) return existing
    const reading = this.request(
      'thread/read',
      { threadId, includeTurns: false },
      (value) => (value as ThreadReadResponse).thread.agentNickname || null,
    ).catch(() => {
      console.warn('Rejected 1 unreadable Codex Subagent thread; it shows no nickname.')
      return null
    })
    const recorded = reading.then((nickname) => {
      this.settled.set(threadId, nickname)
      return nickname
    })
    this.byThread.set(threadId, recorded)
    return recorded
  }
}

// A live turn's activities and collab calls, paired by id whichever of the two lands first.
export class CodexSubagentPairing {
  private readonly collabById = new Map<string, CodexCollabFacts>()
  private readonly activityById = new Map<string, SubagentItem>()
  private readonly nicknames: CodexSubagentNicknames | null

  constructor(nicknames: CodexSubagentNicknames | null = null) {
    this.nicknames = nicknames
  }

  // The activity as known now; `redraw` gets its thread's activities again once a nickname is read.
  activity(item: SubagentItem, redraw?: (content: FeedContent) => void): FeedContent {
    this.activityById.set(item.id, item)
    if (redraw !== undefined)
      void this.named(item.agentThreadId).then((named) => named.forEach(redraw))
    return codexSubagentContent(
      item,
      this.collabById.get(item.id),
      this.nicknames?.known(item.agentThreadId) ?? null,
    )
  }

  // Each activity of the thread, redrawn when its nickname is first read; empty once drawn with it,
  // or when it has none.
  private async named(threadId: string): Promise<FeedContent[]> {
    if (this.nicknames === null || this.nicknames.known(threadId) !== null) return []
    if ((await this.nicknames.read(threadId)) === null) return []
    return [...this.activityById.values()]
      .filter((item) => item.agentThreadId === threadId)
      .map((item) => this.activity(item))
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
