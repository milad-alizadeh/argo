import type { SessionRosterRow } from '@/core/sessions/models'
import type { CodexChannel, CodexProcess } from './codex-channel'
import { readCompletedTurn, readInterrupt, readStartedTurn, readThreadId } from './protocol'

type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
type DriverOptions = {
  findExecutable: () => string | null
  openChannel: (executable: string, options: SpawnOptions) => CodexChannel
}
type ManagedSession = {
  channel: CodexChannel
  cwd: string
  prompt: string
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
    async start({ cwd, prompt }) {
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
        sessions.set(startedThreadId, { channel, cwd, prompt, turnId: null, failed: false })
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
    },
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
    roster(): SessionRosterRow[] {
      return [...sessions.entries()].map(([id, session]) => ({
        id,
        retiredIds: [],
        cli: 'codex',
        posture: 'managed',
        title: { text: session.prompt, source: 'first-prompt' },
        status: session.failed ? 'unknown' : 'running',
        entry: 'interactive',
        cwd: session.cwd,
        branch: null,
        updatedAt: null,
        unreadableLines: 0,
        originUnread: false,
        turnStartedAt: null,
        activity: null,
        plan: null,
        delegations: [],
        shell: [],
        pullRequest: null,
        archived: false,
        contextTokens: null,
        spentTokens: null,
      }))
    },
    close() {
      for (const session of sessions.values()) session.channel.close()
      sessions.clear()
    },
  }
}

export type { CodexProcess }
