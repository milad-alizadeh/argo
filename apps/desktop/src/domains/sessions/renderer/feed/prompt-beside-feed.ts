import type { SessionFeedRow } from '@/domains/sessions/renderer/types'

// The optimistic bubble retires once the Feed already shows those words. A managed projection can
// carry the prompt before the roster's turn start moves, and drawing both is two copies of one Send.
export function promptBesideFeed(
  rows: readonly SessionFeedRow[],
  optimistic: SessionFeedRow | null,
  settledPrompt: SessionFeedRow | null,
): SessionFeedRow | null {
  const candidate = optimistic ?? (rows.length === 0 ? settledPrompt : null)
  if (candidate === null || candidate.shape !== 'prose') return candidate
  const shown = rows.some(
    (row) => row.shape === 'prose' && row.role === 'user' && row.text === candidate.text,
  )
  return shown ? null : candidate
}
