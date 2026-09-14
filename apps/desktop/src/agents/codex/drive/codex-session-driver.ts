import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { CodexChannel, CodexProcess } from './codex-channel'
import { CodexSessionDriverError } from './codex-session-error'
import { readInterrupt } from './interrupt-protocol'
import { codexLaunchEnvironment } from './launch-environment'
import { createLiveMessages, type LiveMessage, type LiveMessages } from './live-messages'
import { readStartedTurn, readThreadId } from './protocol'
import { codexNotificationRecorder } from './record-notification'
import { readRename } from './rename-protocol'

type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
type DriverOptions = {
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
  start: (request: { cwd: string; prompt: string }) => Promise<string>
  send: (sessionId: string, text: string) => Promise<void>
  interrupt: (sessionId: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
  roster: () => SessionRosterRow[]
  liveMessages: (sessionId: string) => LiveMessage[]
  close: () => void
}

type Turn = (channel: CodexChannel, threadId: string, prompt: string) => Promise<void>
type SessionRegistry = {
  renameWaiters: Map<string, (title: string) => void>
  sessions: Map<string, ManagedSession>
  turn: Turn
}

async function beginManagedSession(
  options: DriverOptions,
  registry: SessionRegistry,
  { cwd, prompt }: { cwd: string; prompt: string },
): Promise<string> {
  const { renameWaiters, sessions, turn } = registry
  const executable = options.findExecutable()
  if (!executable) throw new CodexSessionDriverError('cli-unavailable')
  let channel: CodexChannel
  try {
    channel = options.openChannel(executable, { cwd, env: codexLaunchEnvironment() })
  } catch {
    throw new CodexSessionDriverError('launch-failed')
  }
  let threadId: string | null = null
  try {
    await channel.request(
      'initialize',
      {
        clientInfo: { name: 'argo', title: 'Argo', version: '1' },
        capabilities: { experimentalApi: false, requestAttestation: false },
      },
      (value) => value,
    )
    channel.notify('initialized')
    const startedThreadId = await channel.request('thread/start', { cwd }, readThreadId)
    threadId = startedThreadId
    const started = { channel, cwd, prompt, startedAt: options.now().toISOString() }
    const messages = createLiveMessages(startedThreadId)
    sessions.set(startedThreadId, { ...started, turnId: null, status: 'running', messages })
    channel.onExit(() => {
      const session = sessions.get(startedThreadId)
      if (session) session.status = 'ended'
    })
    channel.onNotification(codexNotificationRecorder(startedThreadId, sessions, renameWaiters))
    await turn(channel, startedThreadId, prompt)
    return startedThreadId
  } catch (error) {
    channel.close()
    if (threadId !== null) sessions.delete(threadId)
    if (error instanceof CodexSessionDriverError) throw error
    throw new CodexSessionDriverError('launch-failed')
  }
}

export function createCodexSessionDriver(options: DriverOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const renameWaiters = new Map<string, (title: string) => void>()

  function heldSession(sessionId: string): ManagedSession {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('Codex Session is no longer running.')
    return session
  }

  async function turn(channel: CodexChannel, threadId: string, prompt: string) {
    const previous = sessions.get(threadId)
    previous?.messages.keepOnly(previous.turnId)
    const started = await channel.request(
      'turn/start',
      { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }] },
      readStartedTurn,
    )
    const session = sessions.get(threadId)
    if (session) session.turnId = started.id
  }

  return {
    start: (request) => beginManagedSession(options, { renameWaiters, sessions, turn }, request),
    async send(sessionId, text) {
      const session = heldSession(sessionId)
      await turn(session.channel, sessionId, text)
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
    roster: () =>
      [...sessions.entries()].map(([id, session]) =>
        managedRow(id, {
          ...session,
          cli: 'codex',
          setup: { model: null, effort: null, mode: null },
          title: session.title,
        }),
      ),
    liveMessages: (sessionId) => sessions.get(sessionId)?.messages.list() ?? [],
    close() {
      for (const session of sessions.values()) session.channel.close()
      sessions.clear()
    },
  }
}

export type { CodexProcess }
