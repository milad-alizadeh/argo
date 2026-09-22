import type { OwnershipStanding } from '@/domains/sessions/main/lifecycle/ownership/ownership-ledger'
import { readThreadId } from './protocol/protocol'
import { CodexSessionDriverError } from './session/codex-session-error'
import {
  type ManagedSession,
  type ManagedSessionOptions,
  openManagedChannel,
  rememberManagedSession,
} from './supervision/managed-session'

function refuseUnlessResumable(standing: OwnershipStanding) {
  switch (standing) {
    case 'held-elsewhere':
      throw new CodexSessionDriverError('held-elsewhere')
    case 'resumable':
    case 'held-here':
      return
  }
}

export function createResumingChannel(options: {
  driver: ManagedSessionOptions
  sessions: Map<string, ManagedSession>
  renameWaiters: Map<string, (title: string) => void>
}) {
  const { driver, renameWaiters, sessions } = options
  const pending = new Map<string, Promise<ManagedSession>>()

  async function resume(sessionId: string) {
    const standing = driver.ownership?.standing(sessionId) ?? 'resumable'
    refuseUnlessResumable(standing)
    const target = await driver.resumeTarget(sessionId)
    if (!target) throw new CodexSessionDriverError('missing-session')
    const channel = await openManagedChannel(driver, target.cwd)
    try {
      const resumedId = await channel.request(
        'thread/resume',
        { cwd: target.cwd, threadId: sessionId },
        readThreadId,
      )
      if (resumedId !== sessionId) throw new CodexSessionDriverError('launch-failed')
      rememberManagedSession({
        channel,
        cwd: target.cwd,
        driver,
        prompt: '',
        renameWaiters,
        sessionId,
        sessions,
      })
      const resumed = sessions.get(sessionId)
      if (!resumed) throw new CodexSessionDriverError('launch-failed')
      return resumed
    } catch (error) {
      channel.close()
      if (error instanceof CodexSessionDriverError) throw error
      throw new CodexSessionDriverError('launch-failed')
    }
  }

  return async (sessionId: string) => {
    const held = sessions.get(sessionId)
    if (held) return held
    const resuming =
      pending.get(sessionId) ?? resume(sessionId).finally(() => pending.delete(sessionId))
    pending.set(sessionId, resuming)
    return resuming
  }
}
