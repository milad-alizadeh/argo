import { managedRosterRow } from '@/core/sessions/managed-roster-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { CodexChannel, CodexProcess } from './codex-channel'
import { readCompletedTurn, readInterrupt, readStartedTurn, readThreadId } from './protocol'

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
  failed: boolean
}

export type CodexSessionDriver = {
  start: (request: { cwd: string; prompt: string }) => Promise<string>
  send: (sessionId: string, text: string) => Promise<void>
  interrupt: (sessionId: string) => Promise<void>
  roster: () => SessionRosterRow[]
  close: () => void
}

export class CodexSessionDriverError extends Error {
  constructor(readonly code: 'codex-cli-unavailable' | 'codex-launch-failed') {
    super(
      code === 'codex-cli-unavailable'
        ? 'Codex is not available. Run codex doctor to repair it.'
        : 'Argo could not start Codex.',
    )
  }
}

// The scrub ADR-0024 requires: an exported credential is the one way a spawned Session could be
// billed outside the ChatGPT sign-in Argo owns.
function launchEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  return environment
}

type Turn = (channel: CodexChannel, threadId: string, prompt: string) => Promise<void>
type SessionRegistry = { sessions: Map<string, ManagedSession>; turn: Turn }

async function beginManagedSession(
  options: DriverOptions,
  registry: SessionRegistry,
  { cwd, prompt }: { cwd: string; prompt: string },
): Promise<string> {
  const { sessions, turn } = registry
  const executable = options.findExecutable()
  if (!executable) throw new CodexSessionDriverError('codex-cli-unavailable')
  let channel: CodexChannel
  try {
    channel = options.openChannel(executable, { cwd, env: launchEnvironment() })
  } catch {
    throw new CodexSessionDriverError('codex-launch-failed')
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
    sessions.set(startedThreadId, {
      channel,
      cwd,
      prompt,
      startedAt: options.now().toISOString(),
      turnId: null,
      failed: false,
    })
    channel.onExit(() => {
      const session = sessions.get(startedThreadId)
      if (session) session.failed = true
    })
    channel.onNotification((message) => {
      const completed = readCompletedTurn(message)
      if (completed?.threadId !== startedThreadId) return
      const session = sessions.get(startedThreadId)
      if (session && completed.turn.status === 'failed') session.failed = true
    })
    await turn(channel, startedThreadId, prompt)
    return startedThreadId
  } catch (error) {
    channel.close()
    if (threadId !== null) sessions.delete(threadId)
    if (error instanceof CodexSessionDriverError) throw error
    throw new CodexSessionDriverError('codex-launch-failed')
  }
}

export function createCodexSessionDriver(options: DriverOptions): CodexSessionDriver {
  const sessions = new Map<string, ManagedSession>()

  function runningSession(sessionId: string): ManagedSession {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('Codex Session is no longer running.')
    return session
  }

  async function turn(channel: CodexChannel, threadId: string, prompt: string) {
    const started = await channel.request(
      'turn/start',
      { threadId, input: [{ type: 'text', text: prompt, text_elements: [] }] },
      readStartedTurn,
    )
    const session = sessions.get(threadId)
    if (session) session.turnId = started.id
  }

  return {
    start: (request) => beginManagedSession(options, { sessions, turn }, request),
    async send(sessionId, text) {
      const session = runningSession(sessionId)
      await turn(session.channel, sessionId, text)
    },
    async interrupt(sessionId) {
      const session = runningSession(sessionId)
      if (session.turnId === null) return
      await session.channel.request(
        'turn/interrupt',
        { threadId: sessionId, turnId: session.turnId },
        readInterrupt,
      )
    },
    roster: () =>
      [...sessions.entries()].map(([id, session]) =>
        managedRosterRow({
          id,
          cli: 'codex',
          status: session.failed ? 'unknown' : 'running',
          ...session,
        }),
      ),
    close() {
      for (const session of sessions.values()) session.channel.close()
      sessions.clear()
    },
  }
}

export type { CodexProcess }
