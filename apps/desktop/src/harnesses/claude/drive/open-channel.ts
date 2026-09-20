import { compactionProgress, launchArguments } from '@/harnesses/claude/drive/claude-setup'
import { type CompanionPart, openCompanionPlugin } from '@/harnesses/claude/drive/companion-plugin'
import type { ClaudeTurnRequest } from '@/harnesses/claude/drive/deliver-turn'
import type { DriverOptions, ManagedSession } from '@/harnesses/claude/drive/drive-channel'
import { ClaudeSessionDriverError } from '@/harnesses/claude/drive/driver-error'
import { firstFrame } from '@/harnesses/claude/drive/first-frame'
import { createLiveMessages } from '@/harnesses/claude/drive/live-messages'

export type ClaudeProcess = {
  write: (text: string) => void
  kill?: () => void
  onExit?: (listener: () => unknown) => unknown
  onData?: (listener: (data: string) => void) => unknown
}
export type SpawnOptions = { cwd: string; env: NodeJS.ProcessEnv }
// One spawn path with two seeds: a fresh Session names its transcript, a resume names its tip.
export type Seed = { sessionId: string; cwd: string; sessionFlags: string[] } & ClaudeTurnRequest

// The tail of what the TUI drew, enough to read its Mode footer.
const SCREEN_LIMIT = 8000

function launchEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color' }
  delete environment.CLAUDE_CODE_CHILD_SESSION
  return environment
}

function wireProcess(wiring: {
  options: DriverOptions
  sessions: Map<string, ManagedSession>
  sessionId: string
  session: ManagedSession
  frame: ReturnType<typeof firstFrame>
}) {
  const { options, sessions, sessionId, session, frame } = wiring
  session.process.onData?.((data) => {
    session.screen = (session.screen + data).slice(-SCREEN_LIMIT)
    if (session.compactionStartedAt !== null) {
      const progress = compactionProgress(session.screen)
      if (progress !== null) {
        session.compactionPercentage = progress.percentage
        session.compactionTokens = progress.tokens
      }
    }
    frame.see(session.screen)
  })
  options.ledger.bind(sessionId)
  session.process.onExit?.(() => {
    session.ended = true
    // A later channel for the same Session is not this one's to close.
    if (sessions.get(sessionId) !== session) return
    session.close()
    sessions.delete(sessionId)
    options.ledger.release(sessionId)
  })
}

export function openChannel(
  options: DriverOptions,
  sessions: Map<string, ManagedSession>,
  seed: Seed,
): ManagedSession {
  const executable = options.findExecutable()
  if (!executable) throw new ClaudeSessionDriverError('harness-unavailable')
  const messages = createLiveMessages()
  const parts: CompanionPart[] = [
    options.gate.open(seed.sessionId),
    ...(options.extraParts?.(seed.sessionId, messages.record) ?? []),
  ]
  const plugin = openCompanionPlugin(options.pluginRoot, seed.sessionId, parts)
  let process: ClaudeProcess
  try {
    process = options.spawn(
      executable,
      [...seed.sessionFlags, ...launchArguments(seed.setup), '--plugin-dir', plugin.pluginRoot],
      { cwd: seed.cwd, env: launchEnvironment() },
    )
  } catch {
    plugin.close()
    throw new ClaudeSessionDriverError('launch-failed')
  }
  const frame = firstFrame(options.schedule)
  const session: ManagedSession = {
    applied: seed.setup,
    close: plugin.close,
    compactionStartedAt: null,
    compactionPercentage: null,
    compactionTokens: null,
    handoffStartedAt: null,
    handoffBriefPath: null,
    handoffFailure: null,
    cwd: seed.cwd,
    ended: false,
    messages,
    process,
    prompt: seed.prompt,
    queue: frame.ready,
    screen: '',
    startedAt: options.now().toISOString(),
  }
  sessions.set(seed.sessionId, session)
  wireProcess({ options, sessions, sessionId: seed.sessionId, session, frame })
  return session
}
