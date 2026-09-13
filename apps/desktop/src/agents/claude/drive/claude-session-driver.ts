import { claudeTurn } from './claude-turn'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { ClaudePermission } from '@/core/sessions/contract'

type ClaudeProcess = {
  write: (text: string) => void
  kill?: () => void
  onExit?: (listener: () => unknown) => unknown
}
type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
type DriverOptions = {
  findExecutable: () => string | null
  mintSessionId: () => string
  schedule: (callback: () => void) => void
  spawn: (command: string, commandArguments: string[], options: SpawnOptions) => ClaudeProcess
  prepare?: (sessionId: string) => { commandArguments: string[]; close: () => void }
}

export type ClaudeSessionDriver = {
  start: (request: { cwd: string; prompt: string }) => string
  send: (sessionId: string, text: string) => void
  interrupt: (sessionId: string) => void
  roster: () => SessionRosterRow[]
  pendingPermission: (sessionId: string) => ClaudePermission | null
  decidePermission: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  close: () => void
}

const SUBMIT_DELAY_MS = 150
const INTERRUPT = '\u001b'

export class ClaudeSessionDriverError extends Error {
  constructor(readonly code: 'cli-unavailable' | 'launch-failed') {
    super(
      code === 'cli-unavailable'
        ? 'Claude Code is not available. Run claude doctor to repair it.'
        : 'Argo could not start Claude Code.',
    )
  }
}

function launchEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color' }
  delete environment.CLAUDE_CODE_CHILD_SESSION
  return environment
}

export function createClaudeSessionDriver(options: DriverOptions): ClaudeSessionDriver {
  const sessions = new Map<
    string,
    { close: () => void; cwd: string; process: ClaudeProcess; prompt: string }
  >()

  const send = (sessionId: string, text: string) => {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('Claude Session is no longer running.')
    const turn = claudeTurn(text)
    session.process.write(turn.paste)
    options.schedule(() => session.process.write(turn.submit))
  }

  return {
    start({ cwd, prompt }: { cwd: string; prompt: string }) {
      const executable = options.findExecutable()
      if (!executable) throw new ClaudeSessionDriverError('cli-unavailable')
      const sessionId = options.mintSessionId()
      const prepared = options.prepare?.(sessionId)
      let session: ClaudeProcess
      try {
        session = options.spawn(
          executable,
          [
            '--session-id',
            sessionId,
            '--permission-mode',
            'manual',
            ...(prepared?.commandArguments ?? []),
          ],
          { cwd, env: launchEnvironment() },
        )
      } catch {
        prepared?.close()
        throw new ClaudeSessionDriverError('launch-failed')
      }
      sessions.set(sessionId, {
        close: prepared?.close ?? (() => {}),
        cwd,
        process: session,
        prompt,
      })
      session.onExit?.(() => {
        sessions.get(sessionId)?.close()
        sessions.delete(sessionId)
      })
      send(sessionId, prompt)
      return sessionId
    },
    send,
    interrupt(sessionId: string) {
      const session = sessions.get(sessionId)
      if (!session) throw new Error('Claude Session is no longer running.')
      session.process.write(INTERRUPT)
    },
    roster() {
      return [...sessions.entries()].map(([id, session]) => ({
        id,
        retiredIds: [],
        cli: 'claude',
        posture: 'managed',
        title: { text: session.prompt, source: 'first-prompt' },
        status: 'running',
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
    pendingPermission() {
      return null
    },
    decidePermission() {
      return false
    },
    close() {
      for (const session of sessions.values()) {
        session.process.kill?.()
        session.close()
      }
      sessions.clear()
    },
  }
}

export { SUBMIT_DELAY_MS }
