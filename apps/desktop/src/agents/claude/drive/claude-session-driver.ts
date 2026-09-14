import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { ClaudePermission } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import { rollupSessionStatus } from '@/core/sessions/session-status-rollup'
import type { ClaudeTurnRequest } from './deliver-turn'
import { channelActions, type DriverOptions, type ManagedSession } from './drive-channel'
import { ClaudeSessionDriverError } from './driver-error'
import { clearHandoff, completeHandoffs, startHandoff } from './handoff-driver'
import type { LiveMessage } from './live-messages'

export type ClaudeSessionDriver = {
  start: (request: { cwd: string } & ClaudeTurnRequest) => string
  compact: (sessionId: string) => Promise<void>
  completeCompaction: (sessionId: string, completedAt: string) => void
  handoff: (sessionId: string) => Promise<void>
  // Runs on every roster read (the same hot poll path as the ownership ledger): spawns the fresh
  // Session once a handing-off Session's brief arrives, or gives up past the patience limit.
  completeHandoffs: () => void
  send: (sessionId: string, turn: ClaudeTurnRequest) => Promise<void>
  interrupt: (sessionId: string) => void
  rename: (sessionId: string, name: string) => Promise<string>
  liveMessages: (sessionId: string) => LiveMessage[]
  roster: () => SessionRosterRow[]
  isLockedElsewhere: (sessionId: string) => boolean
  pendingPermission: (sessionId: string) => ClaudePermission | null
  decidePermission: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  decideQuestion: (
    sessionId: string,
    questionId: string,
    answers: ClaudeQuestionAnswer[],
  ) => Promise<boolean>
  close: () => void
}

const INTERRUPT = '\u001b'
const COMPACT = '/compact'
type Sessions = Map<string, ManagedSession>

function clearCompaction(session: ManagedSession) {
  session.compactionStartedAt = null
  session.compactionPercentage = null
  session.compactionTokens = null
}

function closeSessions(options: DriverOptions, sessions: Sessions) {
  for (const [sessionId, session] of sessions) {
    session.ended = true
    session.process.kill?.()
    session.close()
    options.ledger.release(sessionId)
  }
  sessions.clear()
  options.gate.close()
}

function startSession(
  options: DriverOptions,
  channel: ReturnType<typeof channelActions>,
  request: { cwd: string } & ClaudeTurnRequest,
) {
  const sessionId = options.mintSessionId()
  const session = channel.open({ sessionId, ...request, sessionFlags: ['--session-id', sessionId] })
  channel.write(session, request).catch(() => {})
  return sessionId
}

async function decideQuestion(
  context: {
    options: DriverOptions
    channel: ReturnType<typeof channelActions>
    sessions: Sessions
  },
  request: { sessionId: string; questionId: string; answers: ClaudeQuestionAnswer[] },
): Promise<boolean> {
  const session = context.sessions.get(request.sessionId)
  if (!session) return false
  const pending = await context.options.pendingQuestion(request.sessionId)
  if (pending === null || pending.id !== request.questionId) return false
  await context.channel.answer(session, request.answers)
  return true
}

function compactSession(options: DriverOptions, sessions: Sessions, sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) throw new ClaudeSessionDriverError('not-drivable')
  clearCompaction(session)
  session.compactionStartedAt = options.now().toISOString()
  session.process.write(COMPACT)
  session.process.write('\r')
}

function completeCompactionFor(sessions: Sessions, sessionId: string, completedAt: string) {
  const session = sessions.get(sessionId)
  if (!session || session.compactionStartedAt === null || completedAt < session.compactionStartedAt)
    return
  clearCompaction(session)
}

function interruptSession(sessions: Sessions, sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) throw new ClaudeSessionDriverError('not-drivable')
  session.messages.retire()
  clearCompaction(session)
  clearHandoff(session)
  session.process.write(INTERRUPT)
}

async function renameSession(
  context: { channel: ReturnType<typeof channelActions>; sessions: Sessions },
  sessionId: string,
  name: string,
) {
  const session = context.sessions.get(sessionId)
  if (!session) throw new ClaudeSessionDriverError('not-drivable')
  await context.channel.rename(session, name)
  session.title = { text: name, source: 'custom' }
  return name
}

function roster(options: DriverOptions, sessions: Sessions) {
  return [...sessions.entries()].map(([id, session]) =>
    managedRow(id, {
      ...session,
      cli: 'claude',
      // No transcript floor participates in a live managed reading, so `unknown` — the honest
      // "nothing observed" floor — leaves the gate's own signal standing unopposed.
      status: rollupSessionStatus('unknown', 'managed', {
        kind: 'claude',
        pendingPermission: options.gate.pending(id) !== null,
      }),
      setup: session.applied,
      title: session.title,
    }),
  )
}

export function createClaudeSessionDriver(options: DriverOptions): ClaudeSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const channel = channelActions(options, sessions)
  return {
    start: (request) => startSession(options, channel, request),
    send: async (sessionId, turn) => {
      await channel.write(await channel.channelFor(sessionId, turn), turn)
    },
    compact: async (sessionId) => compactSession(options, sessions, sessionId),
    completeCompaction: (sessionId, completedAt) =>
      completeCompactionFor(sessions, sessionId, completedAt),
    handoff: (sessionId) => startHandoff(options, sessions, sessionId),
    completeHandoffs: () => completeHandoffs({ options, startSession, channel, sessions }),
    interrupt: (sessionId) => interruptSession(sessions, sessionId),
    rename: (sessionId, name) => renameSession({ channel, sessions }, sessionId, name),
    liveMessages: (sessionId) => sessions.get(sessionId)?.messages.list() ?? [],
    roster: () => roster(options, sessions),
    isLockedElsewhere: (sessionId) => options.ledger.standing(sessionId) === 'held-elsewhere',
    pendingPermission: (sessionId) => options.gate.pending(sessionId),
    decidePermission: (sessionId, permissionId, decision) =>
      options.gate.decide(sessionId, permissionId, decision),
    decideQuestion: (sessionId, questionId, answers) =>
      decideQuestion({ options, channel, sessions }, { sessionId, questionId, answers }),
    close() {
      channel.close()
      closeSessions(options, sessions)
    },
  }
}
