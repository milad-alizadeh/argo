import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer'
import type { WorkspaceActions, WorkspaceCockpit } from '@/domains/workspaces/renderer'
import type { CatalogReadResult } from '@/harnesses/catalog/catalog-read'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import { type RouterInputs, trpc } from '@/platform/renderer/trpc-client'
import {
  type DraftContent,
  useDurableComposerDraft,
} from '../composer/draft/use-durable-composer-draft'
import {
  type ComposerIdentity,
  composerIdentityKey,
  composerIdentityOf,
} from '../composer/identity/composer-identity'
import { COMPOSER_COLUMN, ComposerForm } from '../composer/layout/composer-form'
import type { CatalogFailure } from '../composer/toolbar/turn-configuration-menu'
import {
  type TurnConfiguration,
  initialTurnConfiguration as turnConfigurationFor,
} from '../composer/turn-configuration/turn-configuration'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import type { HarnessControl } from '../harness/harnesses'
import type { Session, SessionListPage } from '../types'

type SessionScreenDetailsProps = {
  permission: ReturnType<typeof import('../composer').useSessionPermission>
  questionPending: boolean
  session: Session | null
  harness: HarnessControl
  selectedSessionId: string | null
  sessionList: SessionListPage | null
  cockpit: Cockpit
  workspaceCockpit: WorkspaceCockpit
  workspaceActions: WorkspaceActions
}

function catalogFailureOf(
  result: CatalogReadResult | undefined,
  queryFailed: boolean,
): CatalogFailure | null {
  if (queryFailed || result?.failure) return { reason: 'load-failed' }
  const info = result?.info
  if (info?.availability === 'unavailable') return { reason: info.reason, detail: info.detail }
  return null
}

function workspaceControl(
  identity: ReturnType<typeof composerIdentityOf>,
  workspaces: WorkspaceCockpit,
  actions: WorkspaceActions,
) {
  if (identity.kind !== 'draft') return null
  return {
    workspaces: workspaces.workspaces,
    workspace: workspaces.workspace,
    onSelect: actions.selectWorkspace,
  }
}

function draftTarget({
  identity,
  harness,
  cockpit,
  workspace,
}: {
  identity: ComposerIdentity
  harness: HarnessControl
  cockpit: Cockpit
  workspace: WorkspaceCockpit
}): RouterInputs['composerDraftCreate']['target'] | null {
  if (identity.kind === 'session') return { type: 'session', sessionId: identity.sessionId }
  if (cockpit.project === null || workspace.workspace === null) return null
  return {
    type: 'project',
    projectId: cockpit.project.id,
    workspaceId: workspace.workspace.id,
    harness: harness.harness,
  }
}

export function SessionComposerArea({
  permission,
  questionPending,
  session,
  harness,
  selectedSessionId,
  sessionList,
  cockpit,
  workspaceCockpit,
  workspaceActions,
}: SessionScreenDetailsProps) {
  const catalogQuery = useQuery(trpc.harnessCatalogRead.queryOptions({ harness: harness.harness }))
  const catalogRefresh = useMutation(trpc.harnessCatalogRefresh.mutationOptions())
  const location = useLocation()
  const catalog = catalogQuery.data?.info ?? null
  const catalogFailure = catalogFailureOf(catalogQuery.data, catalogQuery.isError)
  const identity = composerIdentityOf(selectedSessionId, cockpit.project?.id ?? null)
  const choices = catalog?.availability === 'available' ? catalog : null
  const initialTurnConfiguration =
    choices === null || (identity.kind === 'session' && sessionList === null)
      ? null
      : turnConfigurationFor(choices, {
          identity,
          rows: sessionList?.sessions ?? [],
        })
  const composerKey = composerIdentityKey(identity)
  const target = draftTarget({ identity, harness, cockpit, workspace: workspaceCockpit })
  const draft = useDurableComposerDraft({
    target,
    choices,
    opening: initialTurnConfiguration,
  })
  const navigate = useNavigate()
  const send = async (
    prompt: string,
    turnConfiguration: TurnConfiguration | null,
    attachments: DraftContent['attachments'],
  ) => {
    const sessionId = (await draft?.submit(prompt, turnConfiguration, attachments)) ?? null
    if (sessionId === null) return false
    if (identity.kind === 'draft' && cockpit.project !== null)
      navigate(`/projects/${cockpit.project.id}/sessions/${sessionId}`, { replace: true })
    return true
  }
  // The Session list already knows another process runs it live, so no Send is offered at all (ADR-0040).
  if (session?.locked === true) return <OpenElsewhere onRetry={null} />
  if (draft === null) return null
  const refreshCatalog = () =>
    catalogRefresh.mutate(
      { harness: harness.harness },
      { onSettled: () => void catalogQuery.refetch() },
    )
  return (
    <ReadySessionComposer
      {...{ permission, questionPending, session, harness, workspaceCockpit, workspaceActions }}
      catalogFailure={catalogFailure}
      choices={choices}
      composerKey={composerKey}
      draft={draft}
      focusOnMount={location.state === COMPOSER_FOCUS_STATE}
      identity={identity}
      onRefreshCatalog={refreshCatalog}
      onSend={send}
    />
  )
}

function ReadySessionComposer({
  permission,
  questionPending,
  session,
  harness,
  workspaceCockpit,
  workspaceActions,
  catalogFailure,
  choices,
  composerKey,
  draft,
  focusOnMount,
  identity,
  onRefreshCatalog,
  onSend,
}: Pick<
  SessionScreenDetailsProps,
  'permission' | 'questionPending' | 'session' | 'harness' | 'workspaceCockpit' | 'workspaceActions'
> & {
  catalogFailure: CatalogFailure | null
  choices: Parameters<typeof useDurableComposerDraft>[0]['choices']
  composerKey: string
  draft: NonNullable<ReturnType<typeof useDurableComposerDraft>>
  focusOnMount: boolean
  identity: ComposerIdentity
  onRefreshCatalog: () => void
  onSend: NonNullable<Parameters<typeof ComposerForm>[0]['onSend']>
}) {
  return (
    <>
      {permission.failure ? <Failure message={permission.failure} /> : null}
      <ComposerForm
        sessionId={composerKey}
        initialEditing={draft.initialEditing}
        onEditingChange={draft.onEditingChange}
        focusOnMount={focusOnMount}
        turnConfigurationChoices={choices}
        catalogFailure={catalogFailure}
        refreshCatalog={onRefreshCatalog}
        workspace={workspaceControl(identity, workspaceCockpit, workspaceActions)}
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
        onSend={onSend}
      />
    </>
  )
}

function handoffTitle(sessionList: SessionListPage | null, sessionId: string) {
  const row = sessionList?.sessions.find(({ id }) => id === sessionId)
  return row?.title?.text ?? sessionId
}

function HandoffLink({
  label,
  sessionId,
  sessionList,
  onNavigate,
}: {
  label: string
  sessionId: string
  sessionList: SessionListPage | null
  onNavigate: (path: string) => void
}) {
  const { projectId } = useParams()
  return (
    <p className="mt-2">
      {label}{' '}
      <button
        className="text-foreground underline underline-offset-2"
        onClick={() => onNavigate(`/projects/${projectId}/sessions/${sessionId}`)}
        type="button"
      >
        {handoffTitle(sessionList, sessionId)}
      </button>
    </p>
  )
}

export function SessionHandoffFacts({
  session,
  sessionList = null,
  onNavigate,
}: Pick<SessionScreenDetailsProps, 'session'> & {
  sessionList?: SessionListPage | null
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
          sessionList={sessionList}
          sessionId={session.handoffTo}
        />
      ) : null}
      {session.handoffFrom ? (
        <HandoffLink
          label={t('handoff.from')}
          onNavigate={onNavigate}
          sessionList={sessionList}
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

// One lock icon for any read-only Session, regardless of Harness (#2092 AC #4/#9). A list lock lifts
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
