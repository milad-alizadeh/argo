import type { WireMessage } from './protocol'
import { protocolRecord, protocolString } from './protocol'
import type { AgentMessageText } from './protocol-notifications'

export function readCompletedAgentMessage(message: WireMessage): AgentMessageText | undefined {
  if (!('method' in message) || message.method !== 'item/completed') return undefined
  const item = protocolRecord(message.params.item, 'Completed item')
  if (item.type !== 'agentMessage') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Completed item thread ID'),
    turnId: protocolString(message.params.turnId, 'Completed item Turn ID'),
    itemId: protocolString(item.id, 'Completed item ID'),
    text: protocolString(item.text, 'Completed agent message text'),
  }
}
