import { CODEX_OPENING_SETUP } from '@/domains/sessions/contract/codex-turn-setup'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import { createWatchedChanges } from '@/harnesses/composition/watched-changes'
import { compactCodexSession } from '../compact-session'
import { inputItemsFor } from '../input-items'
import { readInterrupt } from '../protocol/interrupt-protocol'
import { decidePendingPermission } from '../protocol/permission-protocol'
import { readSteeredTurn } from '../protocol/protocol'
import { codexAnswersFor, settleQuestion } from '../protocol/question-protocol'
import { readRename } from '../protocol/rename-protocol'
import { createResumingChannel } from '../resuming-channel'
import {
  type ManagedSession,
  type ManagedSessionOptions,
  managedRoster,
} from '../supervision/managed-session'
import { beginSession, startTurn } from '../turn-lifecycle'
import type { CodexSessionDriver } from './codex-session-driver-types'
import { CodexSessionDriverError } from './codex-session-error'

export type {
  CodexProcess,
  CodexSessionDrive,
  CodexSessionDriver,
  LiveMessage,
  LiveMessages,
} from './codex-session-driver-types'
export { CodexSessionDriverError }

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

async function steerTurn(options: {
  session: ManagedSession | undefined
  sessionId: string
  text: string
  attachments: SessionAttachmentInput[]
}) {
  const { session, sessionId, text, attachments } = options
  if (session?.status !== 'running' || session.turnId === null)
    throw new CodexSessionDriverError('not-drivable')
  await session.channel.request(
    'turn/steer',
    {
      threadId: sessionId,
      input: inputItemsFor(text, attachments),
      expectedTurnId: session.turnId,
    },
    readSteeredTurn,
  )
}

export function createCodexSessionDriver(options: ManagedSessionOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const renameWaiters = new Map<string, (title: string) => void>()
  const rosterChanges = createWatchedChanges()
  const driver: ManagedSessionOptions = { ...options, onPlanUpdated: rosterChanges.notify }
  const channelFor = createResumingChannel({ driver, renameWaiters, sessions })
  return {
    readModelCatalog: options.readModelCatalog,
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
    async steer({ sessionId, text, attachments }) {
      await steerTurn({ session: sessions.get(sessionId), sessionId, text, attachments })
    },
    async interrupt(sessionId) {
      const session = sessions.get(sessionId)
      if (session?.status !== 'running' || session.turnId === null) return
      await session.channel.request(
        'turn/interrupt',
        { threadId: sessionId, turnId: session.turnId },
        readInterrupt,
      )
    },
    compact: (sessionId) => compactCodexSession(sessions, driver.now, sessionId),
    async rename(sessionId, name) {
      const session = sessions.get(sessionId)
      if (!session) throw new Error('Codex Session is no longer running.')
      const accepted = new Promise<string>((resolve) => renameWaiters.set(sessionId, resolve))
      await session.channel.request('thread/name/set', { threadId: sessionId, name }, readRename)
      return accepted
    },
    roster: () => managedRoster(sessions),
    onRosterChanged: rosterChanges.subscribe,
    liveMessages: (sessionId) => sessions.get(sessionId)?.messages.list() ?? [],
    isLockedElsewhere: (sessionId) => driver.ownership?.standing(sessionId) === 'held-elsewhere',
    pendingQuestion: (sessionId) => sessions.get(sessionId)?.pendingQuestion ?? null,
    pendingPermission: (sessionId) => sessions.get(sessionId)?.pendingPermission ?? null,
    decidePermission: (sessionId, permissionId, decision) =>
      decidePendingPermission(sessions.get(sessionId), permissionId, decision),
    decideQuestion(sessionId, questionId, answers) {
      const session = sessions.get(sessionId)
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
