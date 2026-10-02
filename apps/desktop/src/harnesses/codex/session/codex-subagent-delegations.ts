import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest, ThreadItem } from '../app-server'
import { type CodexCollabFacts, codexFeedContent } from './codex-feed'
import { readCodexNickname } from './codex-subagent-nicknames'

type SubagentItem = Extract<ThreadItem, { type: 'subAgentActivity' }>
type CollabItem = Extract<ThreadItem, { type: 'collabAgentToolCall' }>
// The Turn, and the command that started it, an item belongs to.
type TurnPlace = { commandId: string | null; turnId: string }

// A Subagent activity and the collab call behind it share an id; either may land first.
export function followCodexSubagentDelegations(options: {
  request: CodexRequest
  reject: (type: string) => void
  draw: (content: FeedContent, itemId: string, place: TurnPlace) => void
}) {
  const collabById = new Map<string, CodexCollabFacts>()
  const activityById = new Map<string, SubagentItem>()
  const nicknameByThread = new Map<string, string>()

  function draw(item: SubagentItem, place: TurnPlace) {
    const nickname = nicknameByThread.get(item.agentThreadId)
    for (const content of codexFeedContent(item, options.reject, collabById.get(item.id)))
      options.draw(
        content.kind === 'delegation' && nickname ? { ...content, nickname } : content,
        item.id,
        place,
      )
  }

  return {
    // Drawn at once, and again with the nickname only a read of the Subagent's own thread gives.
    activity(item: SubagentItem, place: TurnPlace) {
      activityById.set(item.id, item)
      draw(item, place)
      if (nicknameByThread.has(item.agentThreadId)) return
      void readCodexNickname(options.request, item.agentThreadId).then((nickname) => {
        if (nickname === null) return
        nicknameByThread.set(item.agentThreadId, nickname)
        draw(item, place)
      })
    },
    collab(item: CollabItem, place: TurnPlace) {
      collabById.set(item.id, { prompt: item.prompt, model: item.model })
      const activity = activityById.get(item.id)
      if (activity !== undefined) draw(activity, place)
    },
    // A Turn's items end with it; nicknames outlive it.
    clear() {
      collabById.clear()
      activityById.clear()
    },
  }
}
