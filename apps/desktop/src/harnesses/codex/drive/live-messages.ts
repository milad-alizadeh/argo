import {
  type AgentMessageText,
  readCompletedAgentMessage,
} from '@/harnesses/codex/drive/agent-message-protocol'
import type { WireMessage } from '@/harnesses/codex/drive/protocol/protocol'
import { readAgentMessageDelta } from '@/harnesses/codex/drive/protocol/protocol-notifications'

// An agent message as the app-server has streamed it so far; `id` is its rollout message id.
export type LiveMessage = { id: string; text: string }

function readMessageText(
  message: WireMessage,
): (AgentMessageText & { whole: boolean }) | undefined {
  try {
    const delta = readAgentMessageDelta(message)
    if (delta !== undefined) return { ...delta, whole: false }
    const completed = readCompletedAgentMessage(message)
    return completed === undefined ? undefined : { ...completed, whole: true }
  } catch {
    // A malformed message costs the live draft only; the rollout still records the message.
    return undefined
  }
}

// The agent messages of one thread's latest Turns, by item id, in the order Codex began them.
export function createLiveMessages(threadId: string) {
  const messages = new Map<string, { turnId: string; text: string }>()
  return {
    // True when the notification was an agent message's text, whichever thread it named.
    record(message: WireMessage): boolean {
      const text = readMessageText(message)
      if (text === undefined) return false
      if (text.threadId !== threadId) return true
      const held = text.whole ? '' : (messages.get(text.itemId)?.text ?? '')
      messages.set(text.itemId, { turnId: text.turnId, text: held + text.text })
      return true
    },
    list: (): LiveMessage[] => [...messages].map(([id, { text }]) => ({ id, text })),
    // A person can write again before the rollout holds the last reply, so that Turn stays.
    keepOnly(turnId: string | null) {
      for (const [id, message] of messages) if (message.turnId !== turnId) messages.delete(id)
    },
  }
}

export type LiveMessages = ReturnType<typeof createLiveMessages>
