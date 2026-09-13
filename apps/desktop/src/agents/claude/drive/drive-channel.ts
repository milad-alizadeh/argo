import { SESSION_ERRORS } from '@/core/sessions/session-error'
import type { OwnershipLedger, OwnershipStanding } from './ownership-ledger'
import { type ClaudeTerminal, createTurnQueue, type TurnQueue } from './turn-queue'

type ClaudeProcess = ClaudeTerminal & {
  kill?: () => void
  onExit?: (listener: () => unknown) => unknown
}
type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
// ADR-0026: `--resume` takes the chain's LATEST link, while the Roster and the ledger key the
// Session by its chain id. Held together so a caller cannot name one without the other.
export type ResumeTarget = { cwd: string; tipId: string }
export type DriverOptions = {
  findExecutable: () => string | null
  mintSessionId: () => string
  now: () => Date
  schedule: (callback: () => void, delayMs: number) => void
  spawn: (command: string, commandArguments: string[], options: SpawnOptions) => ClaudeProcess
  prepare?: (sessionId: string) => { commandArguments: string[]; close: () => void }
  ledger: OwnershipLedger
  resumeTarget: (sessionId: string) => Promise<ResumeTarget | null>
}
export type ManagedSession = {
  close: () => void
  cwd: string
  process: ClaudeProcess
  prompt: string
  startedAt: string
  turns: TurnQueue
}
// One spawn path with two seeds: a fresh Session names its transcript, a resume names its tip.
type Seed = { sessionId: string; cwd: string; prompt: string; sessionFlags: string[] }

type DriverErrorCode =
  | 'cli-unavailable'
  | 'launch-failed'
  | 'not-drivable'
  | 'not-resumable'
  | 'held-elsewhere'
  | 'missing-session'

export class ClaudeSessionDriverError extends Error {
  constructor(readonly code: DriverErrorCode) {
    super(SESSION_ERRORS[code])
  }
}

function launchEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color' }
  delete environment.CLAUDE_CODE_CHILD_SESSION
  return environment
}

function openChannel(
  options: DriverOptions,
  sessions: Map<string, ManagedSession>,
  seed: Seed,
): ManagedSession {
  const executable = options.findExecutable()
  if (!executable) throw new ClaudeSessionDriverError('cli-unavailable')
  const prepared = options.prepare?.(seed.sessionId)
  let process: ClaudeProcess
  try {
    process = options.spawn(
      executable,
      [...seed.sessionFlags, '--permission-mode', 'manual', ...(prepared?.commandArguments ?? [])],
      { cwd: seed.cwd, env: launchEnvironment() },
    )
  } catch {
    prepared?.close()
    throw new ClaudeSessionDriverError('launch-failed')
  }
  const session = {
    close: prepared?.close ?? (() => {}),
    cwd: seed.cwd,
    process,
    prompt: seed.prompt,
    startedAt: options.now().toISOString(),
    turns: createTurnQueue(process, options.schedule),
  }
  sessions.set(seed.sessionId, session)
  options.ledger.bind(seed.sessionId)
  process.onExit?.(() => {
    session.turns.stop()
    // A later channel for the same Session is not this one's to close.
    if (sessions.get(seed.sessionId) !== session) return
    session.close()
    sessions.delete(seed.sessionId)
    options.ledger.release(seed.sessionId)
  })
  return session
}

function refuseUnlessResumable(standing: OwnershipStanding) {
  switch (standing) {
    case 'never-owned':
      throw new ClaudeSessionDriverError('not-resumable')
    case 'held-elsewhere':
      throw new ClaudeSessionDriverError('held-elsewhere')
    case 'orphaned':
    case 'held-here':
      return
  }
}

export function channelActions(options: DriverOptions, sessions: Map<string, ManagedSession>) {
  const resuming = new Map<string, Promise<ManagedSession>>()
  let closed = false
  const open = (seed: Seed) => openChannel(options, sessions, seed)

  const resume = async (sessionId: string, prompt: string) => {
    refuseUnlessResumable(options.ledger.standing(sessionId))
    const target = await options.resumeTarget(sessionId)
    if (target === null) throw new ClaudeSessionDriverError('missing-session')
    if (closed) throw new ClaudeSessionDriverError('not-drivable')
    const live = sessions.get(sessionId)
    if (live) return live
    // Another window may have resumed it while the transcript was read.
    refuseUnlessResumable(options.ledger.standing(sessionId))
    return open({ sessionId, cwd: target.cwd, prompt, sessionFlags: ['--resume', target.tipId] })
  }

  return {
    open,
    close() {
      closed = true
    },
    write(session: ManagedSession, text: string) {
      session.turns.send(text)
    },
    // ADR-0026 (#1842): the next Turn reopens a channel; Turns sent during one startup share it.
    channelFor(sessionId: string, prompt: string): Promise<ManagedSession> {
      const live = sessions.get(sessionId)
      if (live) return Promise.resolve(live)
      const pending =
        resuming.get(sessionId) ??
        resume(sessionId, prompt).finally(() => resuming.delete(sessionId))
      resuming.set(sessionId, pending)
      return pending
    },
  }
}
