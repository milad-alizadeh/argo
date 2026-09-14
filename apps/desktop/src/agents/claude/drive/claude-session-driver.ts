import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { ClaudePermission } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { ClaudeTurnRequest } from './deliver-turn'
import { channelActions, type DriverOptions, type ManagedSession } from './drive-channel'
import { ClaudeSessionDriverError } from './driver-error'
import type { LiveMessage } from './live-messages'

export type ClaudeSessionDriver = {
  start: (request: { cwd: string } & ClaudeTurnRequest) => string
  compact: (sessionId: string) => Promise<void>
  completeCompaction: (sessionId: string, completedAt: string) => void
  send: (sessionId: string, turn: ClaudeTurnRequest) => Promise<void>
  interrupt: (sessionId: string) => void
  rename: (sessionId: string, name: string) => Promise<string>
  liveMessages: (sessionId: string) => LiveMessage[]
  roster: () => SessionRosterRow[]
  orphans: () => ReadonlySet<string>
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

function clearCompaction(session: ManagedSession) {
  session.compactionStartedAt = null
  session.compactionPercentage = null
  session.compactionTokens = null
}

function closeSessions(options: DriverOptions, sessions: Map<string, ManagedSession>) {
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
    sessions: Map<string, ManagedSession>
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

function roster(options: DriverOptions, sessions: Map<string, ManagedSession>) {
  return [...sessions.entries()].map(([id, session]) =>
    managedRow(id, {
      ...session,
      cli: 'claude',
      status: options.gate.pending(id) === null ? 'running' : 'permission',
      setup: session.applied,
      title: session.title,
    }),
  )
}

export function createClaudeSessionDriver(options: DriverOptions): ClaudeSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const channel = channelActions(options, sessions)
  return {
    start(request) {
      return startSession(options, channel, request)
    },
    async send(sessionId, turn) {
      await channel.write(await channel.channelFor(sessionId, turn), turn)
    },
    async compact(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      clearCompaction(session)
      session.compactionStartedAt = options.now().toISOString()
      session.process.write(COMPACT)
      session.process.write('\r')
    },
    completeCompaction(sessionId, completedAt) {
      const session = sessions.get(sessionId)
      if (
        !session ||
        session.compactionStartedAt === null ||
        completedAt < session.compactionStartedAt
      )
        return
      clearCompaction(session)
    },
    interrupt(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      session.messages.retire()
      clearCompaction(session)
      session.process.write(INTERRUPT)
    },
    async rename(sessionId, name) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      await channel.rename(session, name)
      session.title = { text: name, source: 'custom' }
      return name
    },
    liveMessages: (sessionId) => sessions.get(sessionId)?.messages.list() ?? [],
    roster: () => roster(options, sessions),
    orphans: options.ledger.orphans,
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
