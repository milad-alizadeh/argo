import { Lock } from 'lucide-react'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import type { HarnessControl } from '../harness/harnesses'
import type { SessionRoster } from '../hooks/useSessions'
import { COMPOSER_COLUMN } from './ComposerForm'
import { PermissionPrompt } from './PermissionPrompt'
import { SessionComposer } from './SessionComposer'

// Only this code means "open elsewhere": no Turn here can ever succeed, so the composer gives
// way to the lock card instead of sitting under it (#2053, #2092). Every other failure code keeps
// its draft in a still-active composer, as before.
const OPEN_ELSEWHERE: ReadonlySet<SessionErrorCode> = new Set(['held-elsewhere'])

type SessionScreenDetailsProps = {
  composer: Pick<
    ReturnType<typeof import('../hooks/useSessionComposer').useSessionComposer>,
    'failure' | 'props' | 'retry'
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
    return <OpenElsewhere onRetry={composer.retry} />
  }
  return (
    <>
      {composer.failure ? <Failure message={composer.failure.message} /> : null}
      {permission.failure ? <Failure message={permission.failure} /> : null}
      <SessionComposer
        {...composer.props}
        contextTokens={session?.contextTokens}
        disabled={questionPending}
        harness={harness}
        permissionPrompt={
          <PermissionPrompt
            cli={harness.cli}
            permission={permission.permission}
            onDecide={permission.decide}
          />
        }
        plan={session?.plan ?? null}
      />
    </>
  )
}

function handoffTitle(roster: SessionRoster, sessionId: string) {
  const row = roster?.sessions.find(({ id }) => id === sessionId)
  return row?.title?.text ?? sessionId
}

function HandoffLink({
  label,
  sessionId,
  roster,
  onNavigate,
}: {
  label: string
  sessionId: string
  roster: SessionRoster
  onNavigate: (path: string) => void
}) {
  return (
    <p className="mt-2">
      {label}{' '}
      <button
        className="text-foreground underline underline-offset-2"
        onClick={() => onNavigate(`/sessions/${sessionId}`)}
        type="button"
      >
        {handoffTitle(roster, sessionId)}
      </button>
    </p>
  )
}

export function SessionHandoffFacts({
  session,
  roster = null,
  onNavigate,
}: Pick<SessionScreenDetailsProps, 'session'> & {
  roster?: SessionRoster
  onNavigate?: (path: string) => void
}) {
  if (session === null || (!session.handoffTo && !session.handoffFrom) || !onNavigate) return null
  return (
    <section aria-label="Session handoff" className="p-4 type-meta text-muted-foreground">
      <h2 className="font-medium text-foreground">Handoff</h2>
      {session.handoffTo ? (
        <HandoffLink
          label="Handed off to"
          onNavigate={onNavigate}
          roster={roster}
          sessionId={session.handoffTo}
        />
      ) : null}
      {session.handoffFrom ? (
        <HandoffLink
          label="Handed off from"
          onNavigate={onNavigate}
          roster={roster}
          sessionId={session.handoffFrom}
        />
      ) : null}
    </section>
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

// One lock icon for any read-only Session, regardless of CLI (#2092 AC #4/#9).
function OpenElsewhere({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={`${COMPOSER_COLUMN} mt-3 pb-(--spacing-session-composer-bottom)`}>
      <Alert>
        <Lock aria-hidden />
        <AlertTitle>This session is open in another app</AlertTitle>
        <AlertDescription>Close it there to continue it in Argo.</AlertDescription>
        <AlertAction>
          <Button onClick={onRetry} size="sm" variant="outline">
            Retry
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
