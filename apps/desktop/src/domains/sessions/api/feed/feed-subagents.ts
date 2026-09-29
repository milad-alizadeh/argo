import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { BACKGROUND_STATES } from './background-task-record'
import type { SessionFeedRow } from './feed-rows'

// A Subagent runs until a response gives it one of the end states its row carries.
const FEED_SUBAGENT_STATES = ['running', ...BACKGROUND_STATES] as const

// One Subagent as its parent's Feed shows it: the newest event decides its state.
export const feedSubagentSchema = z.strictObject({
  id: identifierSchema,
  label: z.string().nullable(),
  nickname: z.string().optional(),
  state: z.enum(FEED_SUBAGENT_STATES),
})
export type FeedSubagent = z.infer<typeof feedSubagentSchema>

type SubagentRow = Extract<SessionFeedRow, { shape: 'subagent' }>

function stateOf(row: SubagentRow): FeedSubagent['state'] {
  switch (row.event) {
    case 'started':
    case 'messaged':
      return 'running'
    case 'responded':
      return row.state ?? 'failed'
  }
}

// Every Subagent a Feed's rows name, by id, in the order each first appeared.
export function feedSubagents(rows: readonly SessionFeedRow[]): FeedSubagent[] {
  const subagents = new Map<string, FeedSubagent>()
  for (const row of rows) {
    if (row.shape !== 'subagent') continue
    const earlier = subagents.get(row.subagentId)
    const nickname = row.nickname ?? earlier?.nickname
    subagents.set(row.subagentId, {
      id: row.subagentId,
      label: row.name ?? earlier?.label ?? null,
      ...(nickname === undefined ? {} : { nickname }),
      state: stateOf(row),
    })
  }
  return [...subagents.values()]
}

// The responses a parent Feed recorded for one Subagent, to end that Subagent's own Feed. Its own
// transcript already holds the reply, so each keeps the end state and drops the text.
export function subagentCompletionRows(
  rows: readonly SessionFeedRow[],
  subagentId: string,
): SessionFeedRow[] {
  return rows.flatMap((row) => {
    if (row.shape !== 'subagent' || row.subagentId !== subagentId || row.event !== 'responded')
      return []
    const { text: _reply, ...completion } = row
    return [completion]
  })
}

// A Subagent's own Feed holds a transcript when any row is more than its parent's record of it.
export function hasSubagentTranscript(
  rows: readonly SessionFeedRow[],
  subagentId: string,
): boolean {
  return rows.some((row) => row.shape !== 'subagent' || row.subagentId !== subagentId)
}
