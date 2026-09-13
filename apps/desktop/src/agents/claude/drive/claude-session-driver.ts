import type { ClaudePermission } from '@/core/sessions/contract'
import { managedRosterRow } from '@/core/sessions/managed-roster-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import { type ClaudeTerminal, createTurnQueue, type TurnQueue } from './turn-queue'

type ClaudeProcess = ClaudeTerminal & {
  kill?: () => void
  onExit?: (listener: () => unknown) => unknown
}
type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
type DriverOptions = {
  findExecutable: () => string | null
  mintSessionId: () => string
  now: () => Date
  schedule: (callback: () => void, delayMs: number) => void
  spawn: (command: string, commandArguments: string[], options: SpawnOptions) => ClaudeProcess
  prepare?: (sessionId: string) => { commandArguments: string[]; close: () => void }
}
type ManagedSession = {
  close: () => void
  cwd: string
  process: ClaudeProcess
  prompt: string
  startedAt: string
  turns: TurnQueue
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
  const sessions = new Map<string, ManagedSession>()
  return driverActions(options, sessions)
}

function driverActions(
  options: DriverOptions,
  sessions: Map<string, ManagedSession>,
): ClaudeSessionDriver {
  const send = (sessionId: string, text: string) => {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('Claude Session is no longer running.')
    session.turns.send(text)
  }

  return {
    start: (request) => startSession({ options, sessions, request }),
    send,
    interrupt(sessionId: string) {
      const session = sessions.get(sessionId)
      if (!session) throw new Error('Claude Session is no longer running.')
      session.process.write(INTERRUPT)
    },
    roster() {
      return [...sessions.entries()].map(([id, session]) =>
        managedRosterRow({ id, cli: 'claude', status: 'running', ...session }),
      )
    },
    pendingPermission() {
      return null
    },
    decidePermission() {
      return false
    },
    close() {
      for (const session of sessions.values()) {
        session.turns.stop()
        session.process.kill?.()
        session.close()
      }
      sessions.clear()
    },
  }
}

function startSession({
  options,
  sessions,
  request: { cwd, prompt },
}: {
  options: DriverOptions
  sessions: Map<string, ManagedSession>
  request: { cwd: string; prompt: string }
}) {
  const executable = options.findExecutable()
  if (!executable) throw new ClaudeSessionDriverError('cli-unavailable')
  const sessionId = options.mintSessionId()
  const prepared = options.prepare?.(sessionId)
  let process: ClaudeProcess
  try {
    process = options.spawn(executable, claudeCommand(sessionId, prepared), {
      cwd,
      env: launchEnvironment(),
    })
  } catch {
    prepared?.close()
    throw new ClaudeSessionDriverError('launch-failed')
  }
  const turns = createTurnQueue(process, options.schedule)
  sessions.set(sessionId, {
    close: prepared?.close ?? (() => {}),
    cwd,
    process,
    prompt,
    startedAt: options.now().toISOString(),
    turns,
  })
  process.onExit?.(() => {
    turns.stop()
    sessions.get(sessionId)?.close()
    sessions.delete(sessionId)
  })
  turns.send(prompt)
  return sessionId
}

function claudeCommand(
  sessionId: string,
  prepared: ReturnType<NonNullable<DriverOptions['prepare']>> | undefined,
) {
  return [
    '--session-id',
    sessionId,
    '--permission-mode',
    'manual',
    ...(prepared?.commandArguments ?? []),
  ]
}
