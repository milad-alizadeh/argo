import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest, ThreadItem } from '../app-server'
import { readCodexNickname } from './codex-subagent-nicknames'

type SubagentItem = Extract<ThreadItem, { type: 'subAgentActivity' }>
type CollabItem = Extract<ThreadItem, { type: 'collabAgentToolCall' }>
type Delegation = Extract<FeedContent, { kind: 'delegation' }>

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
): Delegation {
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

export function withNickname(content: Delegation, nickname: string | null): Delegation {
  return nickname === null ? content : { ...content, nickname }
}

// A live turn's activities and collab calls, paired by id whichever of the two lands first. Each
// activity is redrawn once with its thread's nickname, which only a read of that thread gives.
export class CodexSubagentPairing {
  private readonly request: CodexRequest
  private readonly collabById = new Map<string, CodexCollabFacts>()
  private readonly activityById = new Map<string, SubagentItem>()
  private readonly nicknameByThread = new Map<string, string>()

  constructor(request: CodexRequest) {
    this.request = request
  }

  // `redraw` runs after the read, so the caller binds it to the turn that drew the activity.
  activity(item: SubagentItem, redraw: (content: FeedContent) => void): FeedContent {
    this.activityById.set(item.id, item)
    const call = this.collabById.get(item.id)
    const threadId = item.agentThreadId
    if (!this.nicknameByThread.has(threadId))
      void readCodexNickname(this.request, threadId).then((nickname) => {
        if (nickname === null) return
        this.nicknameByThread.set(threadId, nickname)
        redraw(this.content(item, this.collabById.get(item.id) ?? call))
      })
    return this.content(item, call)
  }

  // The activity this call completes, redrawn with what the call sent; null until it lands.
  collab(item: CollabItem): FeedContent | null {
    this.collabById.set(item.id, { prompt: item.prompt, model: item.model })
    const activity = this.activityById.get(item.id)
    return activity === undefined ? null : this.content(activity, this.collabById.get(item.id))
  }

  clear(): void {
    this.collabById.clear()
    this.activityById.clear()
  }

  private content(item: SubagentItem, call: CodexCollabFacts | undefined): FeedContent {
    return withNickname(
      codexSubagentContent(item, call),
      this.nicknameByThread.get(item.agentThreadId) ?? null,
    )
  }
}
