import { fromPromise } from 'xstate'
import type { SyncResult } from '@/domains/sessions/main/sync/session-sync-machine'
import {
  type ClaudeSessionReader,
  readClaudeSessions,
  systemClaudeSessionReader,
} from './claude-session-reader'

export const claudeSessionSyncActor = fromPromise<
  SyncResult,
  { knownNativeIds: string[]; reader?: ClaudeSessionReader }
>(async ({ input }) => {
  let skipped = 0
  const records = await readClaudeSessions({
    reader: input.reader ?? systemClaudeSessionReader(),
    knownNativeIds: input.knownNativeIds,
    reportMalformed: () => {
      skipped += 1
    },
  })
  return { records, skipped }
})
