import type { SessionAttachmentInput } from '@/core/sessions/attachments-contract'
import type { Cockpit } from '../../projects/hooks/use-projects'
import type { SessionCli } from '../harness/harnesses'
import { useSessionCreationStore } from '../state/use-session-creation-store'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { ComposerIdentity } from './composer-identity'
import { codeFrom, type Failure, messageFrom } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'

export async function startNewSession(
  request: {
    cli: SessionCli
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
    onStarted: (sessionId: string) => void
    onFailed: () => void
  },
) {
  const { cli, cockpit, identity, prompt, setup, attachments, start, setFailure } = request
  const { onSubmitted, afterStart, onStarted, onFailed } = callbacks
  if (cockpit.project === null) {
    setFailure({
      sessionId: null,
      message: 'Select a Project before starting a Session.',
      code: null,
    })
    return false
  }
  const creation = useSessionCreationStore.getState()
  // The "+" click already began this row (`identity.kind === 'pending'`); a Send from a bare
  // composer with no prior "+" begins one here instead. Either way, one draft row exists.
  const pending =
    identity.kind === 'pending' ? creation.pending : creation.begin(cli, cockpit.project.path)
  if (pending === null || pending.stage !== 'draft') return false
  // A rapid second Enter/`+` finds the row already submitting and no-ops (#2109): the observable
  // contract is one user action produces at most one new Session, not which mechanism enforces it.
  if (!creation.startSubmission(pending.id, prompt)) return false
  onSubmitted()
  try {
    const reply = await start.mutateAsync({
      cli,
      cwd: cockpit.project.path,
      prompt,
      setup,
      attachments,
    })
    creation.resolved(pending.id, reply.sessionId)
    setFailure(null)
    await afterStart(reply.sessionId)
    onStarted(reply.sessionId)
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
