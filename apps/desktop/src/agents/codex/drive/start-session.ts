import { CODEX_OPENING_SETUP, type CodexTurnSetup } from '@/core/sessions/codex-contract'
import type { CodexChannel } from './codex-channel'
import type { DriverOptions, SessionRegistry } from './codex-session-driver'
import { CodexSessionDriverError } from './codex-session-error'
import { codexLaunchEnvironment } from './launch-environment'
import { createLiveMessages } from './live-messages'
import { readThreadId } from './protocol'
import { codexNotificationRecorder } from './record-notification'

export async function beginManagedSession(
  options: DriverOptions,
  registry: SessionRegistry,
  { cwd, prompt, setup }: { cwd: string; prompt: string; setup?: CodexTurnSetup },
): Promise<string> {
  const { renameWaiters, sessions, turn } = registry
  const executable = options.findExecutable()
  if (!executable) throw new CodexSessionDriverError('cli-unavailable')
  let channel: CodexChannel
  try {
    channel = options.openChannel(executable, { cwd, env: codexLaunchEnvironment() })
  } catch {
    throw new CodexSessionDriverError('launch-failed')
  }
  let threadId: string | null = null
  try {
    await channel.request(
      'initialize',
      {
        clientInfo: { name: 'argo', title: 'Argo', version: '1' },
        capabilities: { experimentalApi: false, requestAttestation: false },
      },
      (value) => value,
    )
    channel.notify('initialized')
    const startedThreadId = await channel.request('thread/start', { cwd }, readThreadId)
    threadId = startedThreadId
    const messages = createLiveMessages(startedThreadId)
    sessions.set(startedThreadId, {
      channel,
      cwd,
      prompt,
      startedAt: options.now().toISOString(),
      turnId: null,
      status: 'running',
      messages,
    })
    channel.onExit(() => {
      const session = sessions.get(startedThreadId)
      if (session) session.status = 'ended'
    })
    channel.onNotification(codexNotificationRecorder(startedThreadId, sessions, renameWaiters))
    await turn({ channel, threadId: startedThreadId, prompt, setup: setup ?? CODEX_OPENING_SETUP })
    return startedThreadId
  } catch (error) {
    channel.close()
    if (threadId !== null) sessions.delete(threadId)
    if (error instanceof CodexSessionDriverError) throw error
    throw new CodexSessionDriverError('launch-failed')
  }
}
