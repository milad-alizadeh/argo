import type { SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'

const textDeltaSchema = z.object({
  type: z.literal('content_block_delta'),
  index: z.number().int().nonnegative(),
  delta: z.object({ type: z.literal('text_delta'), text: z.string() }),
})
const messageStartSchema = z.object({
  type: z.literal('message_start'),
  message: z.object({ id: z.string().min(1) }),
})

export class ClaudeLiveText {
  private readonly blocks = new Map<string, string>()
  private activeMessageId: string | null = null

  settle(messageId: string): void {
    if (this.activeMessageId === messageId) this.activeMessageId = null
    this.blocks.delete(messageId)
    for (const key of this.blocks.keys())
      if (key.startsWith(`${messageId}:`)) this.blocks.delete(key)
  }

  append(message: SDKPartialAssistantMessage): FeedContent | null {
    const start = messageStartSchema.safeParse(message.event)
    if (start.success) {
      this.activeMessageId = start.data.message.id
      return null
    }
    const event = textDeltaSchema.safeParse(message.event)
    if (!event.success || this.activeMessageId === null) return null
    const id =
      event.data.index === 0 ? this.activeMessageId : `${this.activeMessageId}:${event.data.index}`
    const text = `${this.blocks.get(id) ?? ''}${event.data.delta.text}`
    this.blocks.set(id, text)
    if (this.blocks.size > 500) this.blocks.delete(this.blocks.keys().next().value ?? id)
    return { id, kind: 'message', role: 'assistant', text }
  }
}
