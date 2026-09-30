import type { z } from 'zod'
import type { sessionInsertSchema } from '@/database/session/validation'

export type SessionSummary = Omit<z.infer<typeof sessionInsertSchema>, 'harness'>

export type SessionSummaryListResult = {
  records: SessionSummary[]
  skipped: number
}

export type SessionSummaryListInput = {
  // Stored Sessions the listing may omit, read one by one after it.
  knownNativeIds: readonly string[]
}

export type SessionSummaryList = (
  input: SessionSummaryListInput,
) => Promise<SessionSummaryListResult>

// One Session's summary, or null while the Harness does not list it.
export type SessionSummaryReader = (nativeId: string) => Promise<SessionSummary | null>
