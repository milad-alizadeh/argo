import type { CodexSessionDriver } from '@/agents/codex/drive/codex-session-driver-types'
import { CodexSessionDriverError } from '@/agents/codex/drive/codex-session-error'
import { compactCodexSession } from '@/agents/codex/drive/compact-session'
import { readInterrupt } from '@/agents/codex/drive/interrupt-protocol'
import {
  type ManagedSession,
  type ManagedSessionOptions,
  managedRoster,
} from '@/agents/codex/drive/managed-session'
import { codexAnswersFor, settleQuestion } from '@/agents/codex/drive/question-protocol'
import { readRename } from '@/agents/codex/drive/rename-protocol'
import { createResumingChannel } from '@/agents/codex/drive/resuming-channel'
import { beginSession, startTurn } from '@/agents/codex/drive/turn-lifecycle'
import { CODEX_OPENING_SETUP } from '@/agents/codex/drive/turn-setup-contract'

export type {
  CodexProcess,
  CodexSessionDrive,
  CodexSessionDriver,
  LiveMessage,
  LiveMessages,
} from '@/agents/codex/drive/codex-session-driver-types'
export { CodexSessionDriverError }

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
    start: startManagedSession({ driver, sessions, renameWaiters }),
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
      settleQuestion(session)
      return true
    },
    close: closeManagedSessions(sessions, driver.ownership),
  }
}
