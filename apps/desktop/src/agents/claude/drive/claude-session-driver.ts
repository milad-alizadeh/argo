import { closeSessions } from '@/agents/claude/drive/claude-session-close'
import {
  beginCompaction,
  clearCompaction,
  compactSession,
  completeCompaction,
} from '@/agents/claude/drive/compaction-driver'
import type { ClaudeTurnRequest } from '@/agents/claude/drive/deliver-turn'
import {
  channelActions,
  type DriverOptions,
  type ManagedSession,
} from '@/agents/claude/drive/drive-channel'
import { ClaudeSessionDriverError } from '@/agents/claude/drive/driver-error'
import { clearHandoff, completeHandoffs, startHandoff } from '@/agents/claude/drive/handoff-driver'
import type { LiveMessage } from '@/agents/claude/drive/live-messages'
import { claudeManagedStatus } from '@/agents/claude/drive/managed-status'
import type { ClaudePermission } from '@/agents/claude/drive/turn-setup-contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type { QuestionAnswer } from '@/domains/sessions/contract/question'
import { managedRow } from '@/domains/sessions/main/managed-row'
import { rollupSessionStatus } from '@/domains/sessions/main/session-status-rollup'

export type ClaudeSessionDriver = {
  start: (request: { cwd: string } & ClaudeTurnRequest) => string
  compact: (sessionId: string) => Promise<void>
  beginCompaction: (sessionId: string, startedAt: string) => void
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
  // #2299: the Session screen is told a Permission started or stopped waiting, rather than asking
  // twice a second whether one is there.
  onPermissionsChanged: DriverOptions['gate']['onChanged']
  decidePermission: DriverOptions['gate']['decide']
  decideQuestion: (
    sessionId: string,
    questionId: string,
    answers: QuestionAnswer[],
  ) => Promise<boolean>
  close: () => Promise<void>
}

const INTERRUPT = '\u001b'
type Sessions = Map<string, ManagedSession>

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
  request: { sessionId: string; questionId: string; answers: QuestionAnswer[] },
): Promise<boolean> {
  const session = context.sessions.get(request.sessionId)
  if (!session) return false
  const pending = await context.options.pendingQuestion(request.sessionId)
  if (pending === null || pending.id !== request.questionId) return false
  await context.channel.answer(session, request.answers)
  return true
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
      status: rollupSessionStatus(
        'unknown',
        'managed',
        claudeManagedStatus(options.gate.pending(id) !== null),
      ),
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
    beginCompaction: (sessionId, startedAt) => beginCompaction(sessions, sessionId, startedAt),
    completeCompaction: (sessionId, completedAt) =>
      completeCompaction(sessions, sessionId, completedAt),
    handoff: (sessionId) => startHandoff(options, sessions, sessionId),
    completeHandoffs: () => completeHandoffs({ options, startSession, channel, sessions }),
    interrupt: (sessionId) => interruptSession(sessions, sessionId),
    rename: (sessionId, name) => renameSession({ channel, sessions }, sessionId, name),
    liveMessages: (sessionId) => sessions.get(sessionId)?.messages.list() ?? [],
    roster: () => roster(options, sessions),
    isLockedElsewhere: (sessionId) => options.ledger.standing(sessionId) === 'held-elsewhere',
    pendingPermission: (sessionId) => options.gate.pending(sessionId),
    onPermissionsChanged: (listener) => options.gate.onChanged(listener),
    decidePermission: (sessionId, permissionId, decision) =>
      options.gate.decide(sessionId, permissionId, decision),
    decideQuestion: (sessionId, questionId, answers) =>
      decideQuestion({ options, channel, sessions }, { sessionId, questionId, answers }),
    close() {
      channel.close()
      return closeSessions(options, sessions)
    },
  }
}
