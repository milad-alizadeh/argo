import type { z } from 'zod'
import type { sessionInsertSchema } from '@/database/session/validation'

export type SessionSummary = Omit<z.infer<typeof sessionInsertSchema>, 'harness'>
// A null parent is a Subagent the Harness names no parent for: no Session, and not looked up again.
export type SessionSubagentLink = { nativeId: string; parentNativeId: string | null }

export type SessionSummaryListResult = {
  records: SessionSummary[]
  skipped: number
  subagents?: SessionSubagentLink[]
}

export type SessionSummaryListInput = {
  // Stored Sessions the listing may omit, read one by one after it.
  knownNativeIds: readonly string[]
  // Subagents stored under a Session, whose parent the listing need not look up again; none if absent.
  knownSubagentNativeIds?: readonly string[]
}

export type SessionSummaryList = (
  input: SessionSummaryListInput,
) => Promise<SessionSummaryListResult>

// One Session's summary, or null while the Harness does not list it.
export type SessionSummaryReader = (nativeId: string) => Promise<SessionSummary | null>
