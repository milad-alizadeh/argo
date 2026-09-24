import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import type { Cockpit, ProjectActions } from '@/domains/projects/renderer'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import { trpc } from '@/platform/renderer/trpc-client'
import { composerIdentityKey, composerIdentityOf } from '../composer/identity/composer-identity'
import { COMPOSER_COLUMN, ComposerForm } from '../composer/layout/composer-form'
import { useTurnSetup } from '../composer/turn-setup/use-turn-setup'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import type { HarnessControl } from '../harness/harnesses'
import { useSessionCreationStore } from '../session-creation'
import type { SessionRoster } from '../types'

type SessionScreenDetailsProps = {
  permission: ReturnType<typeof import('../composer').useSessionPermission>
  questionPending: boolean
  session: SessionRosterRow | null
  harness: HarnessControl
  selectedSessionId: string | null
  roster: SessionRoster | null
  cockpit: Cockpit
  projectActions: Pick<ProjectActions, 'selectWorkspace' | 'createManagedWorkspace'>
}

export function SessionComposerArea({
  permission,
  questionPending,
  session,
  harness,
  selectedSessionId,
  roster,
  cockpit,
  projectActions,
}: SessionScreenDetailsProps) {
  const location = useLocation()
  const catalogQuery = useQuery(trpc.harnessCatalogRead.queryOptions({ harness: harness.harness }))
  const catalogRefresh = useMutation(trpc.harnessCatalogRefresh.mutationOptions())
  const catalog = catalogQuery.data?.info ?? null
  const pending = useSessionCreationStore((state) => state.pending)
  const identity = composerIdentityOf(
    selectedSessionId,
    cockpit.project?.id ?? null,
    pending?.stage === 'draft' ? pending.id : null,
  )
  const control = useTurnSetup({
    harness: harness.harness,
    choices: catalog?.availability === 'available' ? catalog : null,
    identity,
    rows: roster?.sessions ?? [],
  })
  // The Roster already knows another process runs it live, so no Send is offered at all (ADR-0040).
  if (session?.locked === true) return <OpenElsewhere onRetry={null} />
  return (
    <>
      {permission.failure ? <Failure message={permission.failure} /> : null}
      <ComposerForm
        sessionId={composerIdentityKey(identity)}
        focusOnMount={location.state === COMPOSER_FOCUS_STATE}
        setup={control}
        catalogError={
          catalogQuery.isError || (catalogQuery.isSuccess && catalog?.availability !== 'available')
        }
        refreshCatalog={() => {
          catalogRefresh.mutate(
            { harness: harness.harness },
            {
              onSettled: () => void catalogQuery.refetch(),
            },
          )
        }}
        workspace={
          identity.kind === 'draft'
            ? {
                workspaces: cockpit.workspaces,
                workspace: cockpit.workspace,
                onSelect: projectActions.selectWorkspace,
                onCreateManaged: () => projectActions.createManagedWorkspace('HEAD'),
              }
            : null
        }
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
