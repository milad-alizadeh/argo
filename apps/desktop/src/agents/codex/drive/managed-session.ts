import type { SessionPlan, SessionRosterRow } from '../../../domains/sessions/contract/models'
import { managedRow } from '../../../domains/sessions/main/managed-row'
import type { OwnershipLedger } from '../../../domains/sessions/main/ownership-ledger'
import type { CodexChannel } from './codex-channel'
import { CodexSessionDriverError } from './codex-session-error'
import { codexLaunchEnvironment } from './launch-environment'
import { createLiveMessages, type LiveMessages } from './live-messages'
import type { PendingCodexQuestion } from './question-protocol'
import { codexNotificationRecorder } from './record-notification'

export type ManagedSession = {
  channel: CodexChannel
  cwd: string
  prompt: string
  plan: SessionPlan | null
  startedAt: string
  turnId: string | null
  status: SessionRosterRow['status']
  messages: LiveMessages
  // Set only from a `thread/compact/start` this driver itself issued; Codex reports completion by
  // item, not by a progress percentage (#2123), so there is no compactionPercentage/Tokens to hold.
  compactionStartedAt: string | null
  title?: { text: string; source: 'custom' }
  pendingQuestion: PendingCodexQuestion | null
}

export type ManagedSessionOptions = {
  findExecutable: () => string | null
  now: () => Date
  onPlanUpdated?: () => void
  openChannel: (
    executable: string,
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => CodexChannel
  ownership?: OwnershipLedger
  resumeTarget: (sessionId: string) => Promise<{ cwd: string } | null>
}

export async function openManagedChannel(options: ManagedSessionOptions, cwd: string) {
  const executable = options.findExecutable()
  if (!executable) throw new CodexSessionDriverError('cli-unavailable')
  let channel: CodexChannel | undefined
  try {
    const opened = options.openChannel(executable, { cwd, env: codexLaunchEnvironment() })
    channel = opened
    await opened.request(
      'initialize',
      {
        clientInfo: { name: 'argo', title: 'Argo', version: '1' },
        capabilities: { experimentalApi: false, requestAttestation: false },
      },
      (value) => value,
    )
    opened.notify('initialized')
    return opened
  } catch (error) {
    channel?.close()
    if (error instanceof CodexSessionDriverError) throw error
    throw new CodexSessionDriverError('launch-failed')
  }
}

export function rememberManagedSession(options: {
  driver: ManagedSessionOptions
  sessionId: string
  channel: CodexChannel
  cwd: string
  prompt: string
  sessions: Map<string, ManagedSession>
  renameWaiters: Map<string, (title: string) => void>
}) {
  const { channel, cwd, driver, prompt, renameWaiters, sessionId, sessions } = options
  const onPlanUpdated = driver.onPlanUpdated ?? (() => {})
  const messages = createLiveMessages(sessionId)
  sessions.set(sessionId, {
    channel,
    cwd,
    prompt,
    plan: null,
    startedAt: driver.now().toISOString(),
    turnId: null,
    status: 'running',
    messages,
    compactionStartedAt: null,
    pendingQuestion: null,
  })
  driver.ownership?.bind(sessionId)
  channel.onExit(() => {
    const session = sessions.get(sessionId)
    if (session) session.status = 'ended'
    driver.ownership?.release(sessionId)
  })
  channel.onNotification(
    codexNotificationRecorder({
      sessionId,
      sessions,
      renameWaiters,
      now: driver.now,
      onPlanUpdated,
    }),
  )
}

export function managedRoster(sessions: Map<string, ManagedSession>): SessionRosterRow[] {
  return [...sessions.entries()].map(([id, session]) =>
    managedRow(id, {
      ...session,
      cli: 'codex',
      plan: session.plan,
      setup: { model: null, effort: null, mode: null },
      title: session.title,
      compactionPercentage: null,
      compactionTokens: null,
    }),
  )
}
