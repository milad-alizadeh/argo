import path from 'node:path'
import { z } from 'zod'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange, HistoryTurn } from '@/harnesses/registration'
import { codexContentFromItems } from './codex-session-history'

const rolloutRecordSchema = z.looseObject({ type: z.string(), payload: z.unknown().optional() })
const textBlockSchema = z.looseObject({ type: z.string(), text: z.string() })
const completedItemSchema = z.looseObject({
  type: z.literal('item_completed'),
  turn_id: z.string().min(1).optional(),
  item: z.looseObject({
    type: z.string(),
    id: z.string().min(1),
    content: z.array(z.unknown()).optional(),
  }),
})
const turnEventSchema = z.looseObject({
  type: z.literal('event_msg'),
  payload: z.looseObject({ type: z.string() }),
})
const turnOfEvent: Record<string, HistoryTurn> = {
  task_started: 'open',
  task_complete: 'closed',
  turn_aborted: 'closed',
}
const messageItemTypeSchema = z.enum(['UserMessage', 'AgentMessage'])

// `YYYY/MM/DD/rollout-<timestamp>-<threadId>.jsonl`, where the thread id may stand alone.
export function codexHistoryOwner(relativePath: string): string | null {
  if (path.extname(relativePath) !== '.jsonl') return null
  const name = path.basename(relativePath, '.jsonl')
  if (!name.startsWith('rollout-')) return null
  return /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)$/.exec(name)?.[1] ?? name
}

function recordOf(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

export function codexHistoryTurn(line: string): HistoryTurn | null {
  const event = turnEventSchema.safeParse(recordOf(line))
  return event.success ? (turnOfEvent[event.data.payload.type] ?? null) : null
}

function threadItemOf(type: z.infer<typeof messageItemTypeSchema>, id: string, texts: string[]) {
  switch (type) {
    case 'UserMessage':
      return { id, type: 'userMessage', content: texts.map((text) => ({ type: 'text', text })) }
    case 'AgentMessage':
      return { id, type: 'agentMessage', text: texts.join('') }
  }
}

function messageEvents(payload: unknown): SessionLiveEventBody[] {
  const completed = completedItemSchema.safeParse(payload)
  if (!completed.success) return []
  const { item, turn_id: turnId } = completed.data
  const type = messageItemTypeSchema.safeParse(item.type)
  if (!type.success) return []
  const texts = (item.content ?? []).flatMap((block) => {
    const text = textBlockSchema.safeParse(block)
    return text.success ? [text.data.text] : []
  })
  // The rollout's own names for these items, in the shape `thread/read` returns them.
  return codexContentFromItems([threadItemOf(type.data, item.id, texts)], item.id).map(
    (feedContent) => ({
      type: 'content',
      commandId: null,
      turnId: turnId ?? null,
      vendorEventId: item.id,
      content: feedContent,
    }),
  )
}

// A command's rollout fields differ from its `thread/read` shape, so the Feed reads it whole.
function completesCommand(line: string): boolean {
  const record = rolloutRecordSchema.safeParse(recordOf(line))
  if (!record.success || record.data.type !== 'event_msg') return false
  const completed = completedItemSchema.safeParse(record.data.payload)
  return completed.success && completed.data.item.type === 'CommandExecution'
}

// Streams the messages a rollout completes and reads the whole Session for a completed command.
export function openCodexHistoryReader(): (lines: readonly string[]) => HistoryChange {
  return (lines) => {
    let rejected = 0
    const events = lines.flatMap((line) => {
      const record = rolloutRecordSchema.safeParse(recordOf(line))
      if (!record.success) {
        rejected += 1
        return []
      }
      return record.data.type === 'event_msg' ? messageEvents(record.data.payload) : []
    })
    if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex rollout line(s).`)
    return lines.some(completesCommand) ? { type: 'rewritten' } : { type: 'appended', events }
  }
}
