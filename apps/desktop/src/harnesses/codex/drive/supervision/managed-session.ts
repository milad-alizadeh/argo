import type { SessionPlan, SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { OwnershipLedger } from '@/domains/sessions/main/lifecycle/ownership/ownership-ledger'
import { managedRow } from '@/domains/sessions/main/lifecycle/status/managed-row'
import { codexLaunchEnvironment } from '../launch-environment'
import { createLiveMessages, type LiveMessages } from '../live-messages'
import { codexApprovalDecision, type PendingCodexPermission } from '../protocol/permission-protocol'
import type { PendingCodexQuestion } from '../protocol/question-protocol'
import { codexNotificationRecorder } from '../protocol/record-notification'
import { CodexSessionDriverError } from '../session/codex-session-error'
import type { CodexChannel } from './codex-channel'

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
  pendingPermission: PendingCodexPermission | null
}

export type ManagedSessionOptions = {
  findExecutable: () => string | null
  now: () => Date
  onPlanUpdated?: () => void
  permissionTimeoutMs?: number
  openChannel: (
    executable: string,
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => CodexChannel
  ownership?: OwnershipLedger
  resumeTarget: (sessionId: string) => Promise<{ cwd: string } | null>
}

export async function openManagedChannel(options: ManagedSessionOptions, cwd: string) {
  const executable = options.findExecutable()
  if (!executable) throw new CodexSessionDriverError('harness-unavailable')
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
    await opened.request('skills/list', { cwds: [cwd], forceReload: true }, (value) => value)
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
    pendingPermission: null,
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
      onPermission: (permission) => {
        const timeout = setTimeout(() => {
          const current = sessions.get(sessionId)
          if (current?.pendingPermission?.requestId !== permission.requestId) return
          current.channel.respond(permission.requestId, codexApprovalDecision(permission, 'deny'))
          current.pendingPermission = null
          if (current.status === 'permission') current.status = 'running'
        }, driver.permissionTimeoutMs ?? 86_400_000)
        timeout.unref()
      },
    }),
  )
}

export function managedRoster(sessions: Map<string, ManagedSession>): SessionRosterRow[] {
  return [...sessions.entries()].map(([id, session]) =>
    managedRow(id, {
      ...session,
      harness: 'codex',
      plan: session.plan,
      setup: { model: null, effort: null, mode: null },
      title: session.title,
      compactionPercentage: null,
      compactionTokens: null,
    }),
  )
}
