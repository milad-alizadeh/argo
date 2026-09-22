import type { DriverOptions, ManagedSession } from './drive-channel'
import { ClaudeSessionDriverError } from './driver-error'

const COMPACT = '/compact'
type Sessions = Map<string, ManagedSession>

export function clearCompaction(session: ManagedSession) {
  session.compactionStartedAt = null
  session.compactionPercentage = null
  session.compactionTokens = null
}

export function compactSession(options: DriverOptions, sessions: Sessions, sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) throw new ClaudeSessionDriverError('not-drivable')
  clearCompaction(session)
  session.compactionStartedAt = options.now().toISOString()
  session.process.write(COMPACT)
  session.process.write('\r')
}

// The `PreCompact` hook also fires for a compaction Argo asked for, which keeps its own start.
export function beginCompaction(sessions: Sessions, sessionId: string, startedAt: string) {
  const session = sessions.get(sessionId)
  if (!session || session.compactionStartedAt !== null) return
  session.compactionStartedAt = startedAt
}

export function completeCompaction(sessions: Sessions, sessionId: string, completedAt: string) {
  const session = sessions.get(sessionId)
  if (!session || session.compactionStartedAt === null || completedAt < session.compactionStartedAt)
    return
  clearCompaction(session)
}
