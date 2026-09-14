import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import type { HarnessControl } from '../harness/harnesses'
import { ClaudePermissionPrompt } from './ClaudePermissionPrompt'
import { COMPOSER_COLUMN } from './ComposerForm'
import { SessionComposer } from './SessionComposer'

// Only this code means "open elsewhere": no Turn here can ever succeed, so the composer gives
// way to the alert instead of sitting under it (#2053). Every other failure code (`not-resumable`
// among them) keeps its draft in a still-active composer, as before.
const OPEN_ELSEWHERE: ReadonlySet<SessionErrorCode> = new Set(['held-elsewhere'])

type SessionScreenDetailsProps = {
  composer: Pick<
    ReturnType<typeof import('../hooks/useSessionComposer').useSessionComposer>,
    'failure' | 'props'
  >
  permission: ReturnType<typeof import('../hooks/useSessionPermission').useSessionPermission>
  questionPending: boolean
  session: SessionRosterRow | null
  harness: HarnessControl
}

export function SessionComposerArea({
  composer,
  permission,
  questionPending,
  session,
  harness,
}: SessionScreenDetailsProps) {
  if (composer.failure?.code && OPEN_ELSEWHERE.has(composer.failure.code)) {
    return <Failure message={composer.failure.message} />
  }
  return (
    <>
      {composer.failure ? <Failure message={composer.failure.message} /> : null}
      {permission.failure ? <Failure message={permission.failure} /> : null}
      {permission.permission ? (
        <ClaudePermissionPrompt permission={permission.permission} onDecide={permission.decide} />
      ) : null}
      <SessionComposer
        {...composer.props}
        contextTokens={session?.contextTokens}
        disabled={questionPending}
        harness={harness}
        plan={session?.plan ?? null}
      />
    </>
  )
}

function Failure({ message }: { message: string }) {
  return (
    <div className={`${COMPOSER_COLUMN} mt-3`}>
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  )
}
