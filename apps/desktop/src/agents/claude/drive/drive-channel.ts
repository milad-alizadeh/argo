import { launchArguments } from './claude-setup'
import { type ClaudeTurnRequest, deliverTurn, type TurnTarget, type Wait } from './deliver-turn'
import { ClaudeSessionDriverError } from './driver-error'
import { firstFrame } from './first-frame'
import type { OwnershipLedger, OwnershipStanding } from './ownership-ledger'

type ClaudeProcess = {
  write: (text: string) => void
  kill?: () => void
  onExit?: (listener: () => unknown) => unknown
  onData?: (listener: (data: string) => void) => unknown
}
type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
// ADR-0026: `--resume` takes the chain's LATEST link, while the Roster and the ledger key the
// Session by its chain id. Held together so a caller cannot name one without the other.
export type ResumeTarget = { cwd: string; tipId: string }
export type DriverOptions = {
  findExecutable: () => string | null
  mintSessionId: () => string
  now: () => Date
  schedule: (callback: () => void, milliseconds: number) => void
  spawn: (command: string, commandArguments: string[], options: SpawnOptions) => ClaudeProcess
  prepare?: (sessionId: string) => { commandArguments: string[]; close: () => void }
  ledger: OwnershipLedger
  resumeTarget: (sessionId: string) => Promise<ResumeTarget | null>
}
export type ManagedSession = TurnTarget & {
  close: () => void
  cwd: string
  process: ClaudeProcess
  prompt: string
  queue: Promise<void>
  startedAt: string
  // Set when `claude` exits or the driver closes; a Turn queued or mid-pause then types nothing.
  ended: boolean
}
// One spawn path with two seeds: a fresh Session names its transcript, a resume names its tip.
type Seed = { sessionId: string; cwd: string; sessionFlags: string[] } & ClaudeTurnRequest

// The tail of what the TUI drew, enough to read its Mode footer.
const SCREEN_LIMIT = 8000

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
      [...seed.sessionFlags, ...launchArguments(seed.setup), ...(prepared?.commandArguments ?? [])],
      { cwd: seed.cwd, env: launchEnvironment() },
    )
  } catch {
    prepared?.close()
    throw new ClaudeSessionDriverError('launch-failed')
  }
  const frame = firstFrame(options.schedule)
  const session: ManagedSession = {
    applied: seed.setup,
    close: prepared?.close ?? (() => {}),
    cwd: seed.cwd,
    ended: false,
    process,
    prompt: seed.prompt,
    queue: frame.ready,
    screen: '',
    startedAt: options.now().toISOString(),
  }
  sessions.set(seed.sessionId, session)
  process.onData?.((data) => {
    session.screen = (session.screen + data).slice(-SCREEN_LIMIT)
    frame.see(session.screen)
  })
  options.ledger.bind(seed.sessionId)
  process.onExit?.(() => {
    session.ended = true
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
  const waitWhileLive =
    (session: ManagedSession): Wait =>
    async (milliseconds) => {
      await new Promise<void>((resolve) => options.schedule(resolve, milliseconds))
      if (session.ended) throw new ClaudeSessionDriverError('not-drivable')
    }

  const resume = async (sessionId: string, turn: ClaudeTurnRequest) => {
    refuseUnlessResumable(options.ledger.standing(sessionId))
    const target = await options.resumeTarget(sessionId)
    if (target === null) throw new ClaudeSessionDriverError('missing-session')
    if (closed) throw new ClaudeSessionDriverError('not-drivable')
    const live = sessions.get(sessionId)
    if (live) return live
    // Another window may have resumed it while the transcript was read.
    refuseUnlessResumable(options.ledger.standing(sessionId))
    return open({ sessionId, cwd: target.cwd, ...turn, sessionFlags: ['--resume', target.tipId] })
  }

  return {
    open,
    close() {
      closed = true
    },
    // Turns queue so one's slash commands and Mode presses finish before the next is typed.
    write(session: ManagedSession, turn: ClaudeTurnRequest) {
      const delivery = session.queue.then(() => {
        if (session.ended) throw new ClaudeSessionDriverError('not-drivable')
        return deliverTurn(session, turn, waitWhileLive(session))
      })
      session.queue = delivery.catch(() => {})
      return delivery
    },
    // ADR-0026 (#1842): the next Turn reopens a channel; Turns sent during one startup share it.
    channelFor(sessionId: string, turn: ClaudeTurnRequest): Promise<ManagedSession> {
      const live = sessions.get(sessionId)
      if (live) return Promise.resolve(live)
      const pending =
        resuming.get(sessionId) ?? resume(sessionId, turn).finally(() => resuming.delete(sessionId))
      resuming.set(sessionId, pending)
      return pending
    },
  }
}
