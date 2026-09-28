import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'

type PartialMessage = Extract<SDKMessage, { type: 'stream_event' }>

export class ClaudeLiveText {
  private readonly blocks = new Map<string, string>()
  private activeMessageId: string | null = null

  settle(messageId: string): void {
    if (this.activeMessageId === messageId) this.activeMessageId = null
    this.blocks.delete(messageId)
    for (const key of this.blocks.keys())
      if (key.startsWith(`${messageId}:`)) this.blocks.delete(key)
  }

  append(message: PartialMessage): FeedContent | null {
    const event = message.event
    if (event.type === 'message_start') {
      this.activeMessageId = event.message.id
      return null
    }
    if (
      event.type !== 'content_block_delta' ||
      event.delta.type !== 'text_delta' ||
      this.activeMessageId === null
    )
      return null
    const id = event.index === 0 ? this.activeMessageId : `${this.activeMessageId}:${event.index}`
    const text = `${this.blocks.get(id) ?? ''}${event.delta.text}`
    this.blocks.set(id, text)
    if (this.blocks.size > 500) this.blocks.delete(this.blocks.keys().next().value ?? id)
    return { id, kind: 'message', role: 'assistant', text }
  }
}
