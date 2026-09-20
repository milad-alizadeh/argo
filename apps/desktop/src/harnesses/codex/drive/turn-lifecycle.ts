import {
  CODEX_OPENING_SETUP,
  type CodexTurnSetup,
  codexTurnSettings,
} from '@/domains/sessions/contract/codex-turn-setup'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import { CodexSessionDriverError } from '@/harnesses/codex/drive/codex-session-error'
import { inputItemsFor } from '@/harnesses/codex/drive/input-items'
import type { ManagedSession, ManagedSessionOptions } from '@/harnesses/codex/drive/managed-session'
import { openManagedChannel, rememberManagedSession } from '@/harnesses/codex/drive/managed-session'
import { readStartedTurn, readThreadId } from '@/harnesses/codex/drive/protocol'

export async function beginSession(options: {
  driver: ManagedSessionOptions
  sessions: Map<string, ManagedSession>
  renameWaiters: Map<string, (title: string) => void>
  request: {
    cwd: string
    prompt: string
    setup?: CodexTurnSetup
    attachments: SessionAttachmentInput[]
  }
}) {
  const { driver, renameWaiters, request, sessions } = options
  const channel = await openManagedChannel(driver, request.cwd)
  let sessionId: string | null = null
  try {
    sessionId = await channel.request('thread/start', { cwd: request.cwd }, readThreadId)
    rememberManagedSession({
      channel,
      cwd: request.cwd,
      driver,
      prompt: request.prompt,
      renameWaiters,
      sessionId,
      sessions,
    })
    await startTurn({
      attachments: request.attachments,
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
  attachments: SessionAttachmentInput[]
}) {
  const { attachments, channel, prompt, sessionId, sessions, setup } = options
  const previous = sessions.get(sessionId)
  previous?.messages.keepOnly(previous.turnId)
  const started = await channel.request(
    'turn/start',
    {
      threadId: sessionId,
      input: inputItemsFor(prompt, attachments),
      ...codexTurnSettings(setup),
    },
    readStartedTurn,
  )
  const session = sessions.get(sessionId)
  if (session) session.turnId = started.id
}
