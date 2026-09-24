import { z } from 'zod'
import type {
  SessionAvailability,
  SessionHistoryEntry,
} from '@/domains/sessions/contract/session-history'
import type { CodexRequest } from '../app-server/codex-app-server-machine'

const itemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('userMessage'),
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  }),
  z.object({ id: z.string().min(1), type: z.literal('agentMessage'), text: z.string() }),
])
const threadReadSchema = z.object({
  thread: z.object({
    id: z.string().min(1),
    status: z.discriminatedUnion('type', [
      z.object({ type: z.literal('idle') }),
      z.object({ type: z.literal('active'), activeFlags: z.array(z.string()) }),
      z.object({ type: z.literal('notLoaded') }),
      z.object({ type: z.literal('systemError') }),
    ]),
    turns: z.array(z.object({ id: z.string().min(1), items: z.array(z.unknown()) })),
  }),
})

export type CodexHistory = {
  availability: SessionAvailability
  entries: SessionHistoryEntry[]
}

function availability(
  status: z.infer<typeof threadReadSchema>['thread']['status'],
): SessionAvailability {
  switch (status.type) {
    case 'idle':
      return { state: 'available', reason: null }
    case 'active':
      return { state: 'unavailable', reason: 'This Codex Session is active in another app.' }
    case 'notLoaded':
    case 'systemError':
      return { state: 'unknown', reason: 'Codex could not confirm this Session availability.' }
  }
}

export function parseCodexHistory(value: unknown, nativeId: string): CodexHistory {
  const result = threadReadSchema.parse(value)
  if (result.thread.id !== nativeId) throw new Error('Codex read a different Session.')
  const entries = result.thread.turns.flatMap(({ items }) =>
    items.flatMap<SessionHistoryEntry>((raw) => {
      const item = itemSchema.safeParse(raw)
      if (!item.success) return []
      switch (item.data.type) {
        case 'userMessage': {
          const text = item.data.content.map((content) => content.text).join('')
          return text === '' ? [] : [{ sourceId: item.data.id, role: 'user' as const, text }]
        }
        case 'agentMessage':
          return item.data.text === ''
            ? []
            : [{ sourceId: item.data.id, role: 'assistant' as const, text: item.data.text }]
      }
      return []
    }),
  )
  return { availability: availability(result.thread.status), entries }
}

export async function readCodexHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<CodexHistory> {
  return request('thread/read', { threadId: nativeId, includeTurns: true }, (value) =>
    parseCodexHistory(value, nativeId),
  )
}
