import type { ClaudePermission } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { ClaudeTurnRequest } from './deliver-turn'
import {
  ClaudeSessionDriverError,
  channelActions,
  type DriverOptions,
  type ManagedSession,
} from './drive-channel'

export type ClaudeSessionDriver = {
  start: (request: { cwd: string } & ClaudeTurnRequest) => string
  compact: (sessionId: string) => Promise<void>
  completeCompaction: (sessionId: string, completedAt: string) => void
  send: (sessionId: string, turn: ClaudeTurnRequest) => Promise<void>
  interrupt: (sessionId: string) => void
  roster: () => SessionRosterRow[]
  orphans: () => ReadonlySet<string>
  pendingPermission: (sessionId: string) => ClaudePermission | null
  decidePermission: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  close: () => void
}

const INTERRUPT = '\u001b'
const COMPACT = '/compact'

function clearCompaction(session: ManagedSession) {
  session.compactionStartedAt = null
  session.compactionPercentage = null
  session.compactionTokens = null
}

function rosterRow(id: string, session: ManagedSession) {
  return {
    ...managedRow(id, { ...session, cli: 'claude', status: 'running', setup: session.applied }),
    compactionStartedAt: session.compactionStartedAt,
    compactionPercentage: session.compactionPercentage,
    compactionTokens: session.compactionTokens,
  }
}

export function createClaudeSessionDriver(options: DriverOptions): ClaudeSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const channel = channelActions(options, sessions)
  return {
    start(request) {
      const sessionId = options.mintSessionId()
      const session = channel.open({
        sessionId,
        ...request,
        sessionFlags: ['--session-id', sessionId],
      })
      // The Session is reported running now; a failed opening Turn shows as its process ending.
      channel.write(session, request).catch(() => {})
      return sessionId
    },
    async send(sessionId, turn) {
      await channel.write(await channel.channelFor(sessionId, turn), turn)
    },
    async compact(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      session.compactionStartedAt = new Date().toISOString()
      session.compactionPercentage = null
      session.compactionTokens = null
      try {
        session.process.write(COMPACT)
        session.process.write('\r')
      } catch (error) {
        clearCompaction(session)
        throw error
      }
    },
    completeCompaction(sessionId, completedAt) {
      const session = sessions.get(sessionId)
      if (!session || session.compactionStartedAt === null) return
      if (Date.parse(completedAt) < Date.parse(session.compactionStartedAt)) return
      clearCompaction(session)
    },
    interrupt(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      clearCompaction(session)
      session.process.write(INTERRUPT)
    },
    roster: () => [...sessions.entries()].map(([id, session]) => rosterRow(id, session)),
    orphans: options.ledger.orphans,
    pendingPermission: () => null,
    decidePermission: () => false,
    close() {
      channel.close()
      for (const [sessionId, session] of sessions) {
        session.process.kill?.()
        session.close()
        options.ledger.release(sessionId)
      }
      sessions.clear()
    },
  }
}
