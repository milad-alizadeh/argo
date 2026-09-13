import { readAgentMessageDelta, readCompletedAgentMessage, type WireMessage } from './protocol'

// An agent message as the app-server has streamed it so far; `id` is its rollout message id.
export type LiveMessage = { id: string; text: string }

function readMessageText(message: WireMessage) {
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

// The agent messages of one thread's newest Turn, by item id, in the order Codex began them.
export function createLiveMessages(threadId: string) {
  const messages = new Map<string, string>()
  return {
    // True when the notification was an agent message's text, whichever thread it named.
    record(message: WireMessage): boolean {
      const text = readMessageText(message)
      if (text === undefined) return false
      if (text.threadId !== threadId) return true
      const held = text.whole ? '' : (messages.get(text.itemId) ?? '')
      messages.set(text.itemId, held + text.text)
      return true
    },
    list: (): LiveMessage[] => [...messages].map(([id, text]) => ({ id, text })),
    clear: () => messages.clear(),
  }
}

export type LiveMessages = ReturnType<typeof createLiveMessages>
