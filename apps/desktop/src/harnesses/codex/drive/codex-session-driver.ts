import { CODEX_OPENING_SETUP } from '@/domains/sessions/contract/codex-turn-setup'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import { createWatchedChanges } from '@/harnesses/composition/watched-changes'
import type { CodexSessionDriver } from './codex-session-driver-types'
import { CodexSessionDriverError } from './codex-session-error'
import { compactCodexSession } from './compact-session'
import { inputItemsFor } from './input-items'
import { readInterrupt } from './interrupt-protocol'
import { type ManagedSession, type ManagedSessionOptions, managedRoster } from './managed-session'
import { decidePendingPermission } from './permission-protocol'
import { readSteeredTurn } from './protocol'
import { codexAnswersFor, settleQuestion } from './question-protocol'
import { readRename } from './rename-protocol'
import { createResumingChannel } from './resuming-channel'
import { beginSession, startTurn } from './turn-lifecycle'

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
    async steer({ sessionId, text, attachments }) {
      await steerTurn({ session: held(sessionId), sessionId, text, attachments })
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
    onRosterChanged: rosterChanges.subscribe,
    liveMessages: (sessionId) => held(sessionId)?.messages.list() ?? [],
    isLockedElsewhere: (sessionId) => driver.ownership?.standing(sessionId) === 'held-elsewhere',
    pendingQuestion: (sessionId) => held(sessionId)?.pendingQuestion ?? null,
    pendingPermission: (sessionId) => held(sessionId)?.pendingPermission ?? null,
    decidePermission: (sessionId, permissionId, decision) =>
      decidePendingPermission(held(sessionId), permissionId, decision),
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
