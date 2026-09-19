import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import {
  CODEX_OPENING_SETUP,
  type CodexTurnSetup,
} from '@/domains/sessions/contract/codex-contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import type { QuestionAnswer } from '@/domains/sessions/contract/question'
import type { CodexProcess } from './codex-channel'
import { CodexSessionDriverError } from './codex-session-error'
import { compactCodexSession } from './compact-session'
import { readInterrupt } from './interrupt-protocol'
import type { LiveMessage, LiveMessages } from './live-messages'
import { type ManagedSession, type ManagedSessionOptions, managedRoster } from './managed-session'
import { codexAnswersFor, type PendingCodexQuestion } from './question-protocol'
import { readRename } from './rename-protocol'
import { createResumingChannel } from './resuming-channel'
import { beginSession, startTurn } from './turn-lifecycle'

export type { CodexProcess, LiveMessage, LiveMessages }
export { CodexSessionDriverError }

export type CodexSessionDriver = {
  start: (request: {
    cwd: string
    prompt: string
    setup?: CodexTurnSetup
    attachments: SessionAttachmentInput[]
  }) => Promise<string>
  send: (request: {
    sessionId: string
    text: string
    setup: CodexTurnSetup | undefined
    attachments: SessionAttachmentInput[]
  }) => Promise<void>
  interrupt: (sessionId: string) => Promise<void>
  compact: (sessionId: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
  roster: () => SessionRosterRow[]
  onRosterChanged: (listener: () => void) => () => void
  liveMessages: (sessionId: string) => LiveMessage[]
  isLockedElsewhere: (sessionId: string) => boolean
  pendingQuestion: (sessionId: string) => PendingCodexQuestion | null
  decideQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => boolean
  close: () => void
}

export type CodexSessionDrive = Pick<
  CodexSessionDriver,
  | 'start'
  | 'send'
  | 'interrupt'
  | 'compact'
  | 'rename'
  | 'roster'
  | 'liveMessages'
  | 'pendingQuestion'
  | 'decideQuestion'
  | 'close'
>

function rosterChanges() {
  const listeners = new Set<() => void>()
  return {
    notify: () => {
      for (const listener of listeners) listener()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function startManagedSession({
  driver,
  sessions,
  renameWaiters,
}: {
  driver: ManagedSessionOptions
  sessions: Map<string, ManagedSession>
  renameWaiters: Map<string, (title: string) => void>
}) {
  return (request: Parameters<CodexSessionDriver['start']>[0]) =>
    beginSession({ driver, renameWaiters, request, sessions })
}

function closeManagedSessions(
  sessions: Map<string, ManagedSession>,
  ownership: ManagedSessionOptions['ownership'],
) {
  return () => {
    for (const [sessionId, session] of sessions) {
      ownership?.release(sessionId)
      session.channel.close()
    }
    sessions.clear()
  }
}

export function createCodexSessionDriver(options: ManagedSessionOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const renameWaiters = new Map<string, (title: string) => void>()
  const changes = rosterChanges()
  const driver: ManagedSessionOptions = { ...options, onPlanUpdated: changes.notify }
  const held = (sessionId: string) => sessions.get(sessionId)
  const channelFor = createResumingChannel({ driver, renameWaiters, sessions })

  return {
    start: startManagedSession({
      driver,
      sessions,
      renameWaiters,
    }),
    async send({ sessionId, text, setup, attachments }) {
      const session = await channelFor(sessionId)
      await startTurn({
        attachments,
        channel: session.channel,
        prompt: text,
        sessionId,
        sessions,
        setup: setup ?? CODEX_OPENING_SETUP,
      })
    },
    async interrupt(sessionId) {
      const session = held(sessionId)
      if (session?.status !== 'running' || session.turnId === null) return
      await session.channel.request(
        'turn/interrupt',
        { threadId: sessionId, turnId: session.turnId },
        readInterrupt,
      )
    },
    compact: (sessionId) => compactCodexSession(sessions, driver.now, sessionId),
    async rename(sessionId, name) {
      const session = held(sessionId)
      if (!session) throw new Error('Codex Session is no longer running.')
      const accepted = new Promise<string>((resolve) => renameWaiters.set(sessionId, resolve))
      await session.channel.request('thread/name/set', { threadId: sessionId, name }, readRename)
      return accepted
    },
    roster: () => managedRoster(sessions),
    onRosterChanged: changes.subscribe,
    liveMessages: (sessionId) => held(sessionId)?.messages.list() ?? [],
    isLockedElsewhere: (sessionId) => driver.ownership?.standing(sessionId) === 'held-elsewhere',
    pendingQuestion: (sessionId) => held(sessionId)?.pendingQuestion ?? null,
    decideQuestion(sessionId, questionId, answers) {
      const session = held(sessionId)
      if (session === undefined || session.pendingQuestion === null) return false
      const pending = session.pendingQuestion
      if (pending.itemId !== questionId) return false
      session.channel.respond(pending.requestId, codexAnswersFor(pending, answers))
      Object.assign(session, { pendingQuestion: null, status: 'running' })
      return true
    },
    close: closeManagedSessions(sessions, driver.ownership),
  }
}
