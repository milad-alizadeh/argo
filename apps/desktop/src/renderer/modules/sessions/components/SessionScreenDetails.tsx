import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import type { HarnessControl } from '../harness/harnesses'
import type { SessionRoster } from '../hooks/useSessions'
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
  session: SessionRosterRow | null
  harness: HarnessControl
}

export function SessionComposerArea({
  composer,
  permission,
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
        harness={harness}
        plan={session?.plan ?? null}
      />
    </>
  )
}

export function SessionWorkInspector({ session }: Pick<SessionScreenDetailsProps, 'session'>) {
  if (session === null || (session.delegations.length === 0 && session.shell.length === 0))
    return null
  return (
    <section aria-label="Session work" className="p-4 type-meta text-muted-foreground">
      {session.delegations.length > 0 ? (
        <div>
          <h2 className="font-medium text-foreground">Subagents</h2>
          {session.delegations.map((delegation) => (
            <p className="mt-2" key={delegation.id}>
              {delegation.label ?? delegation.id}
            </p>
          ))}
        </div>
      ) : null}
      {session.shell.length > 0 ? (
        <div className={session.delegations.length > 0 ? 'mt-4' : undefined}>
          <h2 className="font-medium text-foreground">Shell</h2>
          {session.shell.map((command) => (
            <p className="mt-2 font-mono" key={command.id}>
              {command.command ?? command.id}
            </p>
          ))}
        </div>
      ) : null}
    </section>
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
