import type { FeedOverlay } from '@/core/sessions/live-feed'
import type { SessionFeedRow } from '@/core/sessions/models'
import type { LiveMessage } from '../drive/live-messages'

type Prose = Extract<SessionFeedRow, { shape: 'prose' }>

const isProse = (row: SessionFeedRow, role: Prose['role']): row is Prose =>
  row.shape === 'prose' && row.role === role

// The Messages the transcript already holds for the running Turn: every assistant prose row after
// the last prompt. A tool result is a `source` row, so tool calls do not end the Turn.
function landedMessages(rows: readonly SessionFeedRow[]): Prose[] {
  const prompt = rows.findLastIndex((row) => isProse(row, 'user'))
  return rows.slice(prompt + 1).filter((row): row is Prose => isProse(row, 'assistant'))
}

// The hook's `message_id` names no transcript record, so a draft is matched to its row by Turn
// and by order. A landed row keeps the draft's id for the rest of this launch, so the reveal and
// the scroll anchor carry on over the row rather than starting again (`aliases`).
export function draftOverlay(
  live: LiveMessage[],
  aliases: Map<string, string>,
): FeedOverlay | null {
  if (live.length === 0 && aliases.size === 0) return null
  return (rows) => {
    const landed = landedMessages(rows)
    const taken = new Set(aliases.values())
    landed.slice(0, live.length).forEach((row, index) => {
      const draft = `display:${live[index]?.id}`
      if (aliases.has(row.id) || taken.has(draft)) return
      if (row.text.startsWith(live[index]?.text ?? '')) aliases.set(row.id, draft)
    })
    const drafts = live.slice(landed.length).map(
      (message): SessionFeedRow => ({
        shape: 'prose',
        id: `display:${message.id}`,
        role: 'assistant',
        text: message.text,
      }),
    )
    const shown = rows.map((row) => {
      const id = aliases.get(row.id)
      return id === undefined ? row : { ...row, id }
    })
    return { rows: [...shown, ...drafts], changes: { drafts, aliases: [...aliases] } }
  }
}
