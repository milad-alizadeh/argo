import { CodexSessionDriverError } from '@/harnesses/codex/drive/codex-session-error'
import { readCompactStart } from '@/harnesses/codex/drive/compact-protocol'
import type { ManagedSession } from '@/harnesses/codex/drive/managed-session'

// `thread/compact/start` only acks that Codex began compacting (#2123); completion arrives later,
// as an `item/completed` notification, and clears `compactionStartedAt` in record-notification.ts.
export async function compactCodexSession(
  sessions: Map<string, ManagedSession>,
  now: () => Date,
  sessionId: string,
): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) throw new CodexSessionDriverError('not-drivable')
  session.compactionStartedAt = now().toISOString()
  try {
    await session.channel.request('thread/compact/start', { threadId: sessionId }, readCompactStart)
  } catch (error) {
    session.compactionStartedAt = null
    throw error
  }
}
