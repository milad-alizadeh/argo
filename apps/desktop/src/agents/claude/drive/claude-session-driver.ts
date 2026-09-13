import type { ClaudePermission, ClaudeTurnSetup } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import { launchArguments } from './claude-setup'
import { deliverTurn, type TurnTarget, type Wait } from './deliver-turn'

type ClaudeProcess = {
  write: (text: string) => void
  kill?: () => void
  onExit?: (listener: () => unknown) => unknown
  onData?: (listener: (data: string) => void) => unknown
}
type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
type DriverOptions = {
  findExecutable: () => string | null
  mintSessionId: () => string
  schedule: (callback: () => void, milliseconds: number) => void
  spawn: (command: string, commandArguments: string[], options: SpawnOptions) => ClaudeProcess
  prepare?: (sessionId: string) => { commandArguments: string[]; close: () => void }
}
type ManagedSession = TurnTarget & {
  close: () => void
  cwd: string
  process: ClaudeProcess
  prompt: string
  queue: Promise<void>
}

export type ClaudeTurnRequest = { prompt: string; setup: ClaudeTurnSetup }

export type ClaudeSessionDriver = {
  start: (request: { cwd: string } & ClaudeTurnRequest) => string
  send: (sessionId: string, turn: ClaudeTurnRequest) => Promise<void>
  interrupt: (sessionId: string) => void
  roster: () => SessionRosterRow[]
  pendingPermission: (sessionId: string) => ClaudePermission | null
  decidePermission: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  close: () => void
}

const SCREEN_LIMIT = 8000
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
  const wait: Wait = (milliseconds) =>
    new Promise((resolve) => options.schedule(resolve, milliseconds))
  const send = (sessionId: string, turn: ClaudeTurnRequest) => {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('Claude Session is no longer running.')
    const delivery = session.queue.then(() => deliverTurn(session, turn, wait))
    session.queue = delivery.catch(() => {})
    return delivery
  }

  return {
    start: (request) => startSession({ options, sessions, send, request }),
    send,
    interrupt(sessionId: string) {
      const session = sessions.get(sessionId)
      if (!session) throw new Error('Claude Session is no longer running.')
      session.process.write(INTERRUPT)
    },
    roster() {
      return [...sessions.entries()].map(([id, session]) =>
        managedRow(id, { ...session, cli: 'claude', status: 'running', setup: session.applied }),
      )
    },
    pendingPermission: () => null,
    decidePermission: () => false,
    close() {
      for (const session of sessions.values()) {
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
  send,
  request: { cwd, prompt, setup },
}: {
  options: DriverOptions
  sessions: Map<string, ManagedSession>
  send: ClaudeSessionDriver['send']
  request: { cwd: string } & ClaudeTurnRequest
}) {
  const executable = options.findExecutable()
  if (!executable) throw new ClaudeSessionDriverError('cli-unavailable')
  const sessionId = options.mintSessionId()
  const prepared = options.prepare?.(sessionId)
  let process: ClaudeProcess
  try {
    process = options.spawn(executable, claudeCommand(sessionId, setup, prepared), {
      cwd,
      env: launchEnvironment(),
    })
  } catch {
    prepared?.close()
    throw new ClaudeSessionDriverError('launch-failed')
  }
  const session: ManagedSession = {
    applied: setup,
    close: prepared?.close ?? (() => {}),
    cwd,
    process,
    prompt,
    queue: Promise.resolve(),
    screen: '',
  }
  sessions.set(sessionId, session)
  process.onData?.((data) => {
    session.screen = (session.screen + data).slice(-SCREEN_LIMIT)
  })
  process.onExit?.(() => {
    sessions.get(sessionId)?.close()
    sessions.delete(sessionId)
  })
  // The Session is reported running now; a failed opening Turn shows as its process ending.
  send(sessionId, { prompt, setup }).catch(() => {})
  return sessionId
}

function claudeCommand(
  sessionId: string,
  setup: ClaudeTurnSetup,
  prepared: ReturnType<NonNullable<DriverOptions['prepare']>> | undefined,
) {
  return [
    '--session-id',
    sessionId,
    ...launchArguments(setup),
    ...(prepared?.commandArguments ?? []),
  ]
}
