import type {
  channelActions,
  DriverOptions,
  ManagedSession,
} from '../channel/drive-channel'
import { ClaudeSessionDriverError } from '../channel/driver-error'
import { briefPath, handoffCommand, handoffOpening } from './handoff-script'

// Generous because `/handoff` is a whole turn of real work on the fullest Session there is
// (ported from the deprecated Swift app's `HandoffPatience.default`, `apps/macOS`, read-only).
const DEFAULT_HANDOFF_PATIENCE_MS = 20 * 60 * 1000

export function clearHandoff(session: ManagedSession) {
  session.handoffStartedAt = null
  session.handoffBriefPath = null
}

export async function startHandoff(
  options: DriverOptions,
  sessions: Map<string, ManagedSession>,
  sessionId: string,
) {
  const session = sessions.get(sessionId)
  if (!session) throw new ClaudeSessionDriverError('not-drivable')
  clearHandoff(session)
  session.handoffFailure = null
  const path = briefPath({ root: options.handoffRoot, sessionId, atMs: options.now().getTime() })
  session.handoffStartedAt = options.now().toISOString()
  session.handoffBriefPath = path
  session.process.write(handoffCommand(path))
  session.process.write('\r')
}

// Runs on every roster read (the same hot poll path as the ownership ledger): spawns the fresh
// Session once a handing-off Session's brief arrives, or gives up past the patience limit.
export function completeHandoffs(completion: {
  options: DriverOptions
  startSession: (
    options: DriverOptions,
    channel: ReturnType<typeof channelActions>,
    request: { cwd: string; prompt: string; setup: ManagedSession['applied'] },
  ) => string
  channel: ReturnType<typeof channelActions>
  sessions: Map<string, ManagedSession>
}) {
  const { options, startSession, channel, sessions } = completion
  const patience = options.handoffPatienceMs ?? DEFAULT_HANDOFF_PATIENCE_MS
  for (const [sessionId, session] of sessions) {
    if (session.handoffStartedAt === null || session.handoffBriefPath === null) continue
    const briefContents = options.readHandoffBrief(session.handoffBriefPath)
    if (briefContents !== null && briefContents.trim().length > 0) {
      const startedFrom = { cwd: session.cwd, applied: session.applied }
      const path = session.handoffBriefPath
      clearHandoff(session)
      const freshId = startSession(options, channel, {
        cwd: startedFrom.cwd,
        prompt: handoffOpening(path),
        setup: startedFrom.applied,
      })
      options.handoffLedger.record(sessionId, freshId)
      continue
    }
    const elapsed = options.now().getTime() - Date.parse(session.handoffStartedAt)
    if (elapsed >= patience) {
      clearHandoff(session)
      session.handoffFailure = 'Argo did not receive a handoff brief in time.'
    }
  }
}
