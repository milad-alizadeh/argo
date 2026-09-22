import { useTranslation } from 'react-i18next'
import type { SessionErrorCode } from '@/domains/sessions/contract/ipc/contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { COMPOSER_COLUMN, SessionComposer } from '@/domains/sessions/renderer/composer'
import type { HarnessControl } from '@/domains/sessions/renderer/harness/harnesses'
import type { SessionRoster } from '@/domains/sessions/renderer/types'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'

// Only this code means "open elsewhere": no Turn here can ever succeed, so the composer gives
// way to the lock card instead of sitting under it (#2053, #2092). Every other failure code keeps
// its draft in a still-active composer, as before.
const OPEN_ELSEWHERE: ReadonlySet<SessionErrorCode> = new Set(['held-elsewhere'])

type SessionScreenDetailsProps = {
  composer: Pick<
    ReturnType<typeof import('@/domains/sessions/renderer/composer').useSessionComposer>,
    'failure' | 'props' | 'retry'
  >
  permission: ReturnType<typeof import('@/domains/sessions/renderer/composer').useSessionPermission>
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
  // The Roster already knows another process runs it live, so no Send is offered at all (ADR-0040).
  if (session?.locked === true) return <OpenElsewhere onRetry={null} />
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
        contextWindowTokens={session?.contextWindowTokens}
        disabled={questionPending}
        harness={harness}
        permissionPrompt={
          <PermissionPrompt
            harness={harness.harness}
            permission={permission.permission}
            onDecide={permission.decide}
          />
        }
        plan={session?.plan ?? null}
      />
    </>
  )
}

function handoffTitle(roster: SessionRoster | null, sessionId: string) {
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
  roster: SessionRoster | null
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
  roster?: SessionRoster | null
  onNavigate?: (path: string) => void
}) {
  const { t } = useTranslation('sessions')
  if (session === null || (!session.handoffTo && !session.handoffFrom) || !onNavigate) return null
  return (
    <section aria-label={t('handoff.label')} className="p-4 type-meta text-muted-foreground">
      <h2 className="font-medium text-foreground">{t('handoff.title')}</h2>
      {session.handoffTo ? (
        <HandoffLink
          label={t('handoff.to')}
          onNavigate={onNavigate}
          roster={roster}
          sessionId={session.handoffTo}
        />
      ) : null}
      {session.handoffFrom ? (
        <HandoffLink
          label={t('handoff.from')}
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

// One lock icon for any read-only Session, regardless of Harness (#2092 AC #4/#9). A Roster lock lifts
// on its own at the next poll, so it offers no Retry.
function OpenElsewhere({ onRetry }: { onRetry: (() => void) | null }) {
  const { t } = useTranslation('sessions')
  return (
    <div className={`${COMPOSER_COLUMN} mt-3 pb-(--spacing-session-composer-ink-bottom)`}>
      <Alert>
        <Icon name="awaiting-permission" />
        <AlertTitle>{t('openElsewhere.title')}</AlertTitle>
        <AlertDescription>{t('openElsewhere.description')}</AlertDescription>
        {onRetry === null ? null : (
          <AlertAction>
            <Button onClick={onRetry} size="sm" variant="outline">
              {t('openElsewhere.retry')}
            </Button>
          </AlertAction>
        )}
      </Alert>
    </div>
  )
}
