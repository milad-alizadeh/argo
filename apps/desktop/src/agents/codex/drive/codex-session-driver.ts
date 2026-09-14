import type { SessionAttachmentInput } from '../../../core/sessions/attachments-contract'
import { CODEX_OPENING_SETUP, type CodexTurnSetup } from '../../../core/sessions/codex-contract'
import type { SessionRosterRow } from '../../../core/sessions/models'
import type { CodexProcess } from './codex-channel'
import { CodexSessionDriverError } from './codex-session-error'
import { readInterrupt } from './interrupt-protocol'
import type { LiveMessage, LiveMessages } from './live-messages'
import { type ManagedSession, type ManagedSessionOptions, managedRoster } from './managed-session'
import { readRename } from './rename-protocol'
import { createResumingChannel } from './resuming-channel'
import { beginSession, startTurn } from './turn-lifecycle'

export type { LiveMessage }
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
  rename: (sessionId: string, name: string) => Promise<string>
  roster: () => SessionRosterRow[]
  ownership: Pick<NonNullable<ManagedSessionOptions['ownership']>, 'orphans'>
  liveMessages: (sessionId: string) => LiveMessage[]
  close: () => void
}

export type CodexSessionDrive = Pick<
  CodexSessionDriver,
  'start' | 'send' | 'interrupt' | 'rename' | 'roster' | 'liveMessages' | 'close'
>

export function createCodexSessionDriver(options: ManagedSessionOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const renameWaiters = new Map<string, (title: string) => void>()
  const held = (sessionId: string) => sessions.get(sessionId)
  const channelFor = createResumingChannel({ driver: options, renameWaiters, sessions })

  return {
    start: (request) => beginSession({ driver: options, renameWaiters, request, sessions }),
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
    async rename(sessionId, name) {
      const session = held(sessionId)
      if (!session) throw new Error('Codex Session is no longer running.')
      const accepted = new Promise<string>((resolve) => renameWaiters.set(sessionId, resolve))
      await session.channel.request('thread/name/set', { threadId: sessionId, name }, readRename)
      return accepted
    },
    roster: () => managedRoster(sessions),
    ownership: { orphans: () => options.ownership?.orphans() ?? new Set() },
    liveMessages: (sessionId) => held(sessionId)?.messages.list() ?? [],
    close() {
      for (const [sessionId, session] of sessions) {
        options.ownership?.release(sessionId)
        session.channel.close()
      }
      sessions.clear()
    },
  }
}

export type { CodexProcess, LiveMessages }
