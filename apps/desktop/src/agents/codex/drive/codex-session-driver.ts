import {
  CODEX_OPENING_SETUP,
  type CodexTurnSetup,
  codexTurnSettings,
} from '@/core/sessions/codex-contract'
import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { CodexChannel, CodexProcess } from './codex-channel'
import { CodexSessionDriverError } from './codex-session-error'
import { readInterrupt } from './interrupt-protocol'
import type { LiveMessage, LiveMessages } from './live-messages'
import { readStartedTurn } from './protocol'
import { readRename } from './rename-protocol'
import { beginManagedSession } from './start-session'

type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
export type DriverOptions = {
  findExecutable: () => string | null
  now: () => Date
  openChannel: (executable: string, options: SpawnOptions) => CodexChannel
}
type ManagedSession = {
  channel: CodexChannel
  cwd: string
  prompt: string
  startedAt: string
  turnId: string | null
  status: SessionRosterRow['status']
  messages: LiveMessages
  title?: { text: string; source: 'custom' }
}

export type { LiveMessage }
export { CodexSessionDriverError }

export type CodexSessionDriver = {
  start: (request: { cwd: string; prompt: string; setup?: CodexTurnSetup }) => Promise<string>
  send: (sessionId: string, text: string, setup?: CodexTurnSetup) => Promise<void>
  interrupt: (sessionId: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
  roster: () => SessionRosterRow[]
  liveMessages: (sessionId: string) => LiveMessage[]
  close: () => void
}

type Turn = (request: {
  channel: CodexChannel
  threadId: string
  prompt: string
  setup: CodexTurnSetup
}) => Promise<void>
export type SessionRegistry = {
  renameWaiters: Map<string, (title: string) => void>
  sessions: Map<string, ManagedSession>
  turn: Turn
}

function rosterOf(sessions: Map<string, ManagedSession>) {
  return [...sessions.entries()].map(([id, session]) =>
    managedRow(id, {
      ...session,
      cli: 'codex',
      setup: { model: null, effort: null, mode: null },
      title: session.title,
    }),
  )
}

export function createCodexSessionDriver(options: DriverOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const renameWaiters = new Map<string, (title: string) => void>()

  function heldSession(sessionId: string): ManagedSession {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('Codex Session is no longer running.')
    return session
  }

  async function turn({ channel, threadId, prompt, setup }: Parameters<Turn>[0]) {
    const previous = sessions.get(threadId)
    previous?.messages.keepOnly(previous.turnId)
    const started = await channel.request(
      'turn/start',
      {
        threadId,
        input: [{ type: 'text', text: prompt, text_elements: [] }],
        ...codexTurnSettings(setup),
      },
      readStartedTurn,
    )
    const session = sessions.get(threadId)
    if (session) session.turnId = started.id
  }

  return {
    start: (request) => beginManagedSession(options, { renameWaiters, sessions, turn }, request),
    async send(sessionId, text, setup) {
      const session = heldSession(sessionId)
      await turn({
        channel: session.channel,
        threadId: sessionId,
        prompt: text,
        setup: setup ?? CODEX_OPENING_SETUP,
      })
    },
    async interrupt(sessionId) {
      const session = heldSession(sessionId)
      if (session.status !== 'running' || session.turnId === null) return
      await session.channel.request(
        'turn/interrupt',
        { threadId: sessionId, turnId: session.turnId },
        readInterrupt,
      )
    },
    async rename(sessionId, name) {
      const session = heldSession(sessionId)
      const accepted = new Promise<string>((resolve) => renameWaiters.set(sessionId, resolve))
      await session.channel.request('thread/name/set', { threadId: sessionId, name }, readRename)
      return accepted
    },
    roster: () => rosterOf(sessions),
    liveMessages: (sessionId) => sessions.get(sessionId)?.messages.list() ?? [],
    close() {
      for (const session of sessions.values()) session.channel.close()
      sessions.clear()
    },
  }
}

export type { CodexProcess }
