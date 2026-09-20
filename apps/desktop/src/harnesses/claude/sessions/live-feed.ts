import type { SessionFeedRow } from '@/domains/sessions/contract/model/models'
import type { FeedOverlay } from '@/domains/sessions/main/port'
import type { LiveMessage } from '@/harnesses/claude/drive/live-messages'

type Prose = Extract<SessionFeedRow, { shape: 'prose' }>

const isProse = (row: SessionFeedRow, role: Prose['role']): row is Prose =>
  row.shape === 'prose' && row.role === role

// The Messages the transcript already holds for the running Turn: every assistant prose row after
// the last prompt. A tool result is a `source` row, so tool calls do not end the Turn.
function landedMessages(rows: readonly SessionFeedRow[]): Prose[] {
  const prompt = rows.findLastIndex((row) => isProse(row, 'user'))
  return rows.slice(prompt + 1).filter((row): row is Prose => isProse(row, 'assistant'))
}

const draftId = (message: LiveMessage) => `display:${message.id}`

// The hook's `message_id` names no transcript record, so a draft is matched to its row by Turn
// and by order. A landed row keeps the draft's id for the rest of this launch, so the reveal and
// the scroll anchor carry on over the row rather than starting again (`aliases`).
export function draftOverlay(
  live: LiveMessage[],
  aliases: Map<string, string>,
): FeedOverlay | null {
  if (live.length === 0 && aliases.size === 0) return null
  return (rows) => {
    const taken = new Set(aliases.values())
    const waiting = live.filter((message) => !taken.has(draftId(message)))
    let matched = 0
    // A row the hook never drew, such as a `<synthetic>` API error, is passed over.
    for (const row of landedMessages(rows)) {
      const message = waiting[matched]
      if (message === undefined) break
      if (aliases.has(row.id) || !row.text.startsWith(message.text)) continue
      aliases.set(row.id, draftId(message))
      matched += 1
    }
    const drafts = waiting.slice(matched).map(
      (message): SessionFeedRow => ({
        shape: 'prose',
        id: draftId(message),
        role: 'assistant',
        text: message.text,
      }),
    )
    const shown = rows.map((row) => {
      const id = aliases.get(row.id)
      return id === undefined ? row : { ...row, id }
    })
    return { rows: [...shown, ...drafts], changes: { rows: drafts, aliases: [...aliases] } }
  }
}
