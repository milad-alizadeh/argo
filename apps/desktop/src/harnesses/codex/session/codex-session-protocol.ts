import { z } from 'zod'
import type { LiveSessionCommand } from '@/harnesses/registration'
import type { AgentMessageDeltaNotification } from '../app-server/protocol-generated/v2/agent-message-delta-notification'
import type { ReasoningSummaryTextDeltaNotification } from '../app-server/protocol-generated/v2/reasoning-summary-text-delta-notification'

type CodexInputItem =
  | {
      type: 'text'
      text: string
      text_elements: Array<{ byteRange: { start: number; end: number }; placeholder: string }>
    }
  | { type: 'localImage'; path: string }

export const threadResultSchema = z.object({ thread: z.object({ id: z.string().min(1) }) })
export const turnResultSchema = z.object({ turn: z.object({ id: z.string().min(1) }) })
export const turnNotificationSchema = z.object({
  threadId: z.string().min(1),
  turn: z.object({
    id: z.string().min(1),
    status: z.enum(['inProgress', 'completed', 'failed', 'interrupted']),
  }),
})
export const itemNotificationSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  item: z
    .object({
      id: z.string().min(1),
      type: z.string().min(1),
      text: z.string().optional(),
      content: z.array(z.unknown()).optional(),
    })
    .passthrough(),
})
export const messageDeltaSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
  delta: z.string(),
}) satisfies z.ZodType<AgentMessageDeltaNotification>
export const reasoningSummaryDeltaSchema = messageDeltaSchema.extend({
  summaryIndex: z.number().int().nonnegative(),
}) satisfies z.ZodType<ReasoningSummaryTextDeltaNotification>
export const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000
export const userContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('localImage'), path: z.string() }),
  z.object({ type: z.literal('image'), url: z.string() }),
])

export function inputItems(command: LiveSessionCommand): CodexInputItem[] {
  const items: CodexInputItem[] = [{ type: 'text', text: command.prompt, text_elements: [] }]
  for (const attachment of command.attachments) {
    if (attachment.kind === 'image') items.push({ type: 'localImage', path: attachment.path })
    else
      items.push({
        type: 'text',
        text: attachment.path,
        text_elements: [
          {
            byteRange: { start: 0, end: Buffer.byteLength(attachment.path) },
            placeholder: attachment.path,
          },
        ],
      })
  }
  return items
}
