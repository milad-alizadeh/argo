import { SESSION_ERRORS } from '@/core/sessions/session-error'
import { claudeTurn } from './claude-turn'
import type { OwnershipLedger } from './ownership-ledger'

type ClaudeProcess = {
  write: (text: string) => void
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
  schedule: (callback: () => void) => void
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
}
// One spawn path with two seeds: a fresh Session names its transcript, a resume names its tip.
type Seed = { sessionId: string; cwd: string; prompt: string; chain: string[] }

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
      [...seed.chain, '--permission-mode', 'manual', ...(prepared?.commandArguments ?? [])],
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
  }
  sessions.set(seed.sessionId, session)
  options.ledger.bind(seed.sessionId)
  process.onExit?.(() => {
    // A later channel for the same Session is not this one's to close.
    if (sessions.get(seed.sessionId) !== session) return
    session.close()
    sessions.delete(seed.sessionId)
    options.ledger.release(seed.sessionId)
  })
  return session
}

export function channelActions(options: DriverOptions, sessions: Map<string, ManagedSession>) {
  const resuming = new Map<string, Promise<ManagedSession>>()
  const open = (seed: Seed) => openChannel(options, sessions, seed)

  const resume = async (sessionId: string, prompt: string) => {
    switch (options.ledger.standing(sessionId)) {
      case 'never-owned':
        throw new ClaudeSessionDriverError('not-resumable')
      case 'held-elsewhere':
        throw new ClaudeSessionDriverError('held-elsewhere')
      case 'orphaned':
      case 'held-here':
        break
    }
    const target = await options.resumeTarget(sessionId)
    if (target === null) throw new ClaudeSessionDriverError('missing-session')
    const live = sessions.get(sessionId)
    if (live) return live
    return open({ sessionId, cwd: target.cwd, prompt, chain: ['--resume', target.tipId] })
  }

  return {
    open,
    write(session: ManagedSession, text: string) {
      const turn = claudeTurn(text)
      session.process.write(turn.paste)
      options.schedule(() => session.process.write(turn.submit))
    },
    // ADR-0026 as amended by #1842: the next Turn is what reopens a channel, and two Turns sent
    // inside one `claude` startup share the one agent it starts.
    find(sessionId: string, prompt: string): Promise<ManagedSession> {
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
