import type { Cockpit } from '@/domains/projects/renderer'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { ComposerIdentity } from '@/domains/sessions/renderer/composer/composer-identity'
import {
  codeFrom,
  type Failure,
  messageFrom,
} from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { useSessionCreationStore } from '@/domains/sessions/renderer/session-creation'
import type { TurnSetup } from '@/domains/sessions/renderer/turn-setup/turn-setup'

async function paintRoster(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  if (typeof requestAnimationFrame !== 'function') return
  await new Promise((resolve) => {
    requestAnimationFrame(() => resolve(undefined))
  })
}

export async function startNewSession(
  request: {
    harness: SessionHarness
    cockpit: Cockpit
    identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>
    prompt: string
    setup: TurnSetup | null
    attachments: SessionAttachmentInput[]
    start: Pick<ReturnType<typeof useSessionMutations>['start'], 'mutateAsync'>
    setFailure: (failure: Failure | null) => void
  },
  callbacks: {
    // Fires once this Send is the row's one submission, so a dropped duplicate never reaches it.
    onSubmitted: () => void
    afterStart: (sessionId: string) => Promise<void>
    sendInitialTurn?: (sessionId: string) => Promise<void>
    onStarted: (sessionId: string) => void
    onFailed: () => void
  },
) {
  const { harness, cockpit, identity, prompt, setup, attachments, start, setFailure } = request
  const { onSubmitted, afterStart, sendInitialTurn, onStarted, onFailed } = callbacks
  if (cockpit.project === null) {
    setFailure({
      sessionId: null,
      message: 'Select a Project before starting a Session.',
      code: null,
    })
    return false
  }
  const cwd = cockpit.workspace?.path ?? cockpit.project.path
  const creation = useSessionCreationStore.getState()
  // The "+" click already began this row (`identity.kind === 'pending'`); a Send from a bare
  // composer with no prior "+" begins one here instead. Either way, one draft row exists.
  const pending = identity.kind === 'pending' ? creation.pending : creation.begin(harness, cwd)
  if (pending === null || pending.stage !== 'draft') return false
  // A rapid second Enter/`+` finds the row already submitting and no-ops (#2109): the observable
  // contract is one user action produces at most one new Session, not which mechanism enforces it.
  if (!creation.startSubmission(pending.id, prompt)) return false
  onSubmitted()
  try {
    const reply = await start.mutateAsync({
      harness,
      cwd,
      prompt,
      deferInitialTurn: harness === 'claude',
      setup,
      attachments,
    })
    creation.resolved(pending.id, reply.sessionId)
    setFailure(null)
    onStarted(reply.sessionId)
    await afterStart(reply.sessionId)
    // The Roster paints the real Session before the first Turn, so the row precedes the Harness write.
    await paintRoster()
    await sendInitialTurn?.(reply.sessionId)
    return true
  } catch (error) {
    creation.failed(pending.id)
    setFailure({
      sessionId: null,
      message: messageFrom(error, 'Argo could not start this Session.'),
      code: codeFrom(error),
    })
    onFailed()
    return false
  }
}
