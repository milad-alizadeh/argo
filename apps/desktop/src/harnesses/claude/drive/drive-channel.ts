import type { QuestionAnswer } from '@/domains/sessions/contract/drive'
import type { OwnershipLedger, OwnershipStanding } from '@/domains/sessions/main'
import type { CompanionPart } from './companion-plugin'
import { type ClaudeTurnRequest, deliverTurn, type TurnTarget, type Wait } from './deliver-turn'
import { ClaudeSessionDriverError } from './driver-error'
import type { HandoffLedger } from './handoff-ledger'
import type { LiveMessages } from './live-messages'
import { type ClaudeProcess, openChannel, type Seed } from './open-channel'
import type { ClaudePermissionGate } from './permission-gate'
import { deliverAnswer } from './question-answer'

// ADR-0026: `--resume` takes the chain's LATEST link, while the Roster and the ledger key the
// Session by its chain id. Held together so a caller cannot name one without the other.
export type ResumeTarget = { cwd: string; tipId: string }
export type DriverOptions = {
  findExecutable: () => string | null
  mintSessionId: () => string
  now: () => Date
  schedule: (callback: () => void, milliseconds: number) => void
  spawn: (
    command: string,
    commandArguments: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => ClaudeProcess
  gate: ClaudePermissionGate
  // Where each Session's companion plugin directory is written, one subfolder per Session.
  pluginRoot: string
  // `record` takes each batch the Session's MessageDisplay hook delivers. Any companion parts
  // beyond the Permission gate — today, only the MessageDisplay hook — join the same plugin.
  extraParts?: (sessionId: string, record: (batch: unknown) => void) => CompanionPart[]
  ledger: OwnershipLedger
  resumeTarget: (sessionId: string) => Promise<ResumeTarget | null>
  // Where a handing-off Session's brief lands, and how completeHandoffs reads it back — a sync
  // read because it runs on the same hot poll path as the ownership ledger (#1945).
  handoffRoot: string
  readHandoffBrief: (briefPath: string) => string | null
  handoffLedger: HandoffLedger
  handoffPatienceMs?: number
  pendingQuestion: (sessionId: string) => Promise<{ id: string } | null>
}
export type ManagedSession = TurnTarget & {
  close: () => void
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  handoffStartedAt: string | null
  handoffBriefPath: string | null
  handoffFailure: string | null
  cwd: string
  messages: LiveMessages
  process: ClaudeProcess
  prompt: string
  title?: { text: string; source: 'custom' }
  queue: Promise<void>
  startedAt: string
  // Set when `claude` exits or the driver closes; a Turn queued or mid-pause then types nothing.
  ended: boolean
}

function refuseUnlessResumable(standing: OwnershipStanding) {
  switch (standing) {
    case 'held-elsewhere':
      throw new ClaudeSessionDriverError('held-elsewhere')
    case 'resumable':
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
        session.messages.retire()
        return deliverTurn(session, turn, waitWhileLive(session))
      })
      session.queue = delivery.catch(() => {})
      return delivery
    },
    rename(session: ManagedSession, name: string) {
      const delivery = session.queue.then(async () => {
        if (session.ended) throw new ClaudeSessionDriverError('not-drivable')
        session.process.write(`\u001b[200~/rename ${name}\u001b[201~`)
        await waitWhileLive(session)(150)
        session.process.write('\r')
      })
      session.queue = delivery.catch(() => {})
      return delivery
    },
    // Queued behind any Turn or rename already typing, so an answer never interleaves keystrokes
    // with one of those.
    answer(session: ManagedSession, answers: QuestionAnswer[]) {
      const delivery = session.queue.then(() => {
        if (session.ended) throw new ClaudeSessionDriverError('not-drivable')
        return deliverAnswer(session, answers, waitWhileLive(session))
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
