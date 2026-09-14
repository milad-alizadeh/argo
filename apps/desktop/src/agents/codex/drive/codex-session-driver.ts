import {
  CODEX_OPENING_SETUP,
  type CodexTurnSetup,
  codexTurnSettings,
} from '@/core/sessions/codex-contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { CodexProcess } from './codex-channel'
import { CodexSessionDriverError } from './codex-session-error'
import { readInterrupt } from './interrupt-protocol'
import type { LiveMessage, LiveMessages } from './live-messages'
import {
  type ManagedSession,
  type ManagedSessionOptions,
  managedRoster,
  openManagedChannel,
  rememberManagedSession,
} from './managed-session'
import { readStartedTurn, readThreadId } from './protocol'
import { readRename } from './rename-protocol'
import { createResumingChannel } from './resuming-channel'

export type { LiveMessage }
export { CodexSessionDriverError }

export type CodexSessionDriver = {
  start: (request: { cwd: string; prompt: string; setup?: CodexTurnSetup }) => Promise<string>
  send: (sessionId: string, text: string, setup?: CodexTurnSetup) => Promise<void>
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

async function beginSession(options: {
  driver: ManagedSessionOptions
  sessions: Map<string, ManagedSession>
  renameWaiters: Map<string, (title: string) => void>
  request: { cwd: string; prompt: string; setup?: CodexTurnSetup }
}) {
  const { driver, renameWaiters, request, sessions } = options
  const channel = await openManagedChannel(driver, request.cwd)
  let sessionId: string | null = null
  try {
    sessionId = await channel.request('thread/start', { cwd: request.cwd }, readThreadId)
    rememberManagedSession({
      ...request,
      channel,
      driver,
      renameWaiters,
      sessionId,
      sessions,
    })
    await startTurn({
      channel,
      prompt: request.prompt,
      sessionId,
      sessions,
      setup: request.setup ?? CODEX_OPENING_SETUP,
    })
    return sessionId
  } catch (error) {
    channel.close()
    if (sessionId) {
      sessions.delete(sessionId)
      driver.ownership?.release(sessionId)
    }
    if (error instanceof CodexSessionDriverError) throw error
    throw new CodexSessionDriverError('launch-failed')
  }
}

async function startTurn(options: {
  channel: ManagedSession['channel']
  sessions: Map<string, ManagedSession>
  sessionId: string
  prompt: string
  setup: CodexTurnSetup
}) {
  const { channel, prompt, sessionId, sessions, setup } = options
  const previous = sessions.get(sessionId)
  previous?.messages.keepOnly(previous.turnId)
  const started = await channel.request(
    'turn/start',
    {
      threadId: sessionId,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
      ...codexTurnSettings(setup),
    },
    readStartedTurn,
  )
  const session = sessions.get(sessionId)
  if (session) session.turnId = started.id
}

export function createCodexSessionDriver(options: ManagedSessionOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const renameWaiters = new Map<string, (title: string) => void>()
  const held = (sessionId: string) => sessions.get(sessionId)
  const channelFor = createResumingChannel({ driver: options, renameWaiters, sessions })

  return {
    start: (request) => beginSession({ driver: options, renameWaiters, request, sessions }),
    async send(sessionId, text, setup) {
      const session = await channelFor(sessionId)
      await startTurn({
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
