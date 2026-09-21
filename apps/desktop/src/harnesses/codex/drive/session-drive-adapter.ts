import { codexTurnSetupSchema } from '@/domains/sessions/contract/codex-turn-setup'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type {
  DriveFailure,
  SessionDriveAdapter,
} from '@/domains/sessions/contract/session-drive-adapter'
import type { CodexSessionDrive } from '@/harnesses/codex/drive/codex-session-driver'
import { CodexSessionDriverError } from '@/harnesses/codex/drive/codex-session-error'

const FAILURE_MESSAGES = {
  'harness-unavailable': 'Codex is not available. Run codex doctor to repair it.',
  'launch-failed': 'Argo could not start Codex.',
  'not-drivable': 'Argo no longer holds this Codex Session.',
  'held-elsewhere': 'Another Argo window is driving this Codex Session.',
  'stale-permission': 'This Codex permission is no longer waiting.',
  'stale-question': 'This Codex question is no longer waiting.',
} as const

// `codex app-server` refuses a thread already active in another process (its own client or the
// standalone Codex app) with a JSON-RPC error naming that fact; every other refusal falls back to
// the caller's own code. The exact wording still needs a live repro against a held Session (#2053)
// to replace this heuristic with the real one.
const ACTIVE_ELSEWHERE = /already active|in use|held by|another (client|session|instance)/i

function failureOf(error: unknown, fallback: DriveFailure['error']): DriveFailure {
  if (error instanceof CodexSessionDriverError) return { error: error.code }
  const message = error instanceof Error ? error.message : ''
  if (ACTIVE_ELSEWHERE.test(message)) return { error: 'held-elsewhere' }
  return { error: fallback }
}

async function steer(options: {
  driver: CodexSessionDrive
  sessionId: string
  prompt: string
  attachments: SessionAttachmentInput[]
}) {
  const { driver, sessionId, prompt, attachments } = options
  if (driver.steer === undefined) return { error: 'not-drivable' } as const
  try {
    await driver.steer({ sessionId, text: prompt, attachments })
    return { ok: true } as const
  } catch (error) {
    return failureOf(error, 'not-drivable')
  }
}

export function createCodexDriveAdapter(driver: CodexSessionDrive): SessionDriveAdapter {
  return {
    harness: 'codex',
    failureMessage: (code) => FAILURE_MESSAGES[code],
    turnSetupSchema: codexTurnSetupSchema,
    async start({ cwd, prompt, setup, attachments }) {
      const parsedSetup = codexTurnSetupSchema.safeParse(setup)
      if (!parsedSetup.success) return { error: 'launch-failed' }
      try {
        return {
          sessionId: await driver.start({
            attachments,
            cwd,
            prompt,
            setup: parsedSetup.data,
          }),
        }
      } catch (error) {
        return failureOf(error, 'launch-failed')
      }
    },
    async send({ sessionId, prompt, setup, attachments }) {
      const parsedSetup = codexTurnSetupSchema.safeParse(setup)
      if (!parsedSetup.success) return { error: 'not-drivable' }
      try {
        await driver.send({ sessionId, text: prompt, setup: parsedSetup.data, attachments })
        return { ok: true }
      } catch (error) {
        console.error('Argo could not send to Codex Session', sessionId, error)
        return failureOf(error, 'not-drivable')
      }
    },
    async steer({ sessionId, prompt, attachments }) {
      return steer({ driver, sessionId, prompt, attachments })
    },
    async interrupt({ sessionId }) {
      try {
        await driver.interrupt(sessionId)
        return { ok: true }
      } catch (error) {
        console.error('Argo could not interrupt Codex Session', sessionId, error)
        return failureOf(error, 'not-drivable')
      }
    },
    async compact({ sessionId }) {
      try {
        await driver.compact(sessionId)
        return { ok: true }
      } catch (error) {
        console.error('Argo could not compact Codex Session', sessionId, error)
        return failureOf(error, 'not-drivable')
      }
    },
    async handoff() {
      return { error: 'not-drivable' }
    },
    // Codex Permissions are #1841, still out of scope: there is never a pending Permission to
    // read, and a decision always answers that it is no longer waiting.
    async readPermission() {
      return { permission: null }
    },
    async decidePermission() {
      return { error: 'stale-permission' }
    },
    async decideQuestion({ sessionId, questionId, answers }) {
      try {
        if (!driver.decideQuestion(sessionId, questionId, answers)) {
          return { error: 'stale-question' }
        }
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
  }
}
