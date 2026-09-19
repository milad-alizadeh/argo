import { chainMessages } from '../../../domains/sessions/main/roster'
import { pendingAskCall } from '../../../domains/sessions/main/status'
import { readSessionFiles } from './discover'

// The same confirmability status.ts's `isAskPending` reads externally, via the shared
// `pendingAskCall` predicate: a structured question in the last assistant record that no later
// record answers. Read here too, so a decision can be checked against the tool call it actually
// names rather than trusted blind.
export async function claudePendingQuestion(
  transcripts: string,
  sessionId: string,
): Promise<{ id: string } | null> {
  const chain = await readSessionFiles(transcripts, sessionId).catch(() => null)
  if (!chain) return null
  const id = pendingAskCall(chainMessages(chain))
  return id === null ? null : { id }
}
