import {
  CODEX_OPENING_SETUP,
  type CodexTurnSetup,
  codexTurnSettings,
} from '../../../core/sessions/codex-contract'
import { CodexSessionDriverError } from './codex-session-error'
import {
  type ManagedSession,
  type ManagedSessionOptions,
  openManagedChannel,
  rememberManagedSession,
} from './managed-session'
import { readStartedTurn, readThreadId } from './protocol'

export async function beginSession(options: {
  driver: ManagedSessionOptions
  sessions: Map<string, ManagedSession>
  renameWaiters: Map<string, (title: string) => void>
  request: { cwd: string; prompt: string; setup?: CodexTurnSetup }
}) {
  const { driver, renameWaiters, request, sessions } = options
  const channel = await openManagedChannel(driver, request.cwd)
  let sessionId: string | null = null
  try {
    sessionId = await channel.request('thread/start', { cwd: request.cwd }, readThreadId)
    rememberManagedSession({
      ...request,
      channel,
      driver,
      renameWaiters,
      sessionId,
      sessions,
    })
    await startTurn({
      channel,
      prompt: request.prompt,
      sessionId,
      sessions,
      setup: request.setup ?? CODEX_OPENING_SETUP,
    })
    return sessionId
  } catch (error) {
    channel.close()
    if (sessionId) {
      sessions.delete(sessionId)
      driver.ownership?.release(sessionId)
    }
    if (error instanceof CodexSessionDriverError) throw error
    throw new CodexSessionDriverError('launch-failed')
  }
}

export async function startTurn(options: {
  channel: ManagedSession['channel']
  sessions: Map<string, ManagedSession>
  sessionId: string
  prompt: string
  setup: CodexTurnSetup
}) {
  const { channel, prompt, sessionId, sessions, setup } = options
  const previous = sessions.get(sessionId)
  previous?.messages.keepOnly(previous.turnId)
  const started = await channel.request(
    'turn/start',
    {
      threadId: sessionId,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
      ...codexTurnSettings(setup),
    },
    readStartedTurn,
  )
  const session = sessions.get(sessionId)
  if (session) session.turnId = started.id
}
