import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
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
import { HARNESSES, type HarnessControl } from '../harness/harnesses'
import type { Session, SessionListPage } from '../types'

type SessionScreenDetailsProps = {
  permission: ReturnType<typeof import('../composer').useSessionPermission>
  questionPending: boolean
  liveStatus: ReturnType<typeof import('../feed/use-session-feed').useSessionFeed>['liveStatus']
  session: Session | null
  harness: HarnessControl
  selectedSessionId: string | null
  sessionList: SessionListPage | null
  cockpit: Cockpit
  workspaceCockpit: WorkspaceCockpit
  workspaceActions: WorkspaceActions
}

type SessionsTranslator = ReturnType<typeof useTranslation<'sessions'>>['t']

function catalogFailureMessage(
  t: SessionsTranslator,
  harness: HarnessControl['harness'],
  failure: CatalogFailure,
) {
  return t(`composer.turnConfiguration.catalogFailure.${failure.reason}`, {
    harness: HARNESSES[harness].label,
  })
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

function sessionComposerConfiguration(input: {
  selectedSessionId: string | null
  projectId: string | null
  sessionList: SessionListPage | null
  catalogResult: CatalogReadResult | undefined
  catalogFailed: boolean
}) {
  const catalog = input.catalogResult?.info ?? null
  const catalogFailure = catalogFailureOf(input.catalogResult, input.catalogFailed)
  const identity = composerIdentityOf(input.selectedSessionId, input.projectId)
  const choices = catalog?.availability === 'available' ? catalog : null
  const initialTurnConfiguration =
    choices === null || (identity.kind === 'session' && input.sessionList === null)
      ? null
      : turnConfigurationFor(choices, {
          identity,
          rows: input.sessionList?.sessions ?? [],
        })
  return { catalogFailure, choices, initialTurnConfiguration, identity }
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

function useSessionComposerDraft(input: {
  identity: ComposerIdentity
  harness: HarnessControl
  cockpit: Cockpit
  workspaceCockpit: WorkspaceCockpit
  workspaceActions: WorkspaceActions
  choices: Parameters<typeof useDurableComposerDraft>[0]['choices']
  opening: TurnConfiguration | null
}) {
  const { identity, harness, cockpit, workspaceCockpit, workspaceActions, choices, opening } = input
  const target = draftTarget({ identity, harness, cockpit, workspace: workspaceCockpit })
  const [restoredProjectId, setRestoredProjectId] = useState<string | null>(null)
  const projectId = identity.kind === 'draft' ? identity.projectId : null
  const targetRestored = identity.kind === 'session' || restoredProjectId === projectId
  const draft = useDurableComposerDraft({ target, choices, opening, targetRestored })
  const loadedTarget = draft?.loadedTarget
  useEffect(() => {
    if (projectId === null || restoredProjectId === projectId || loadedTarget === undefined) return
    if (loadedTarget === null) {
      setRestoredProjectId(projectId)
      return
    }
    if (loadedTarget.type !== 'project' || loadedTarget.projectId !== projectId) return
    workspaceActions.selectWorkspace(loadedTarget.workspaceId)
    if (harness.harness !== loadedTarget.harness) {
      harness.onChange?.(loadedTarget.harness)
      return
    }
    setRestoredProjectId(projectId)
  }, [
    harness.harness,
    harness.onChange,
    loadedTarget,
    projectId,
    restoredProjectId,
    workspaceActions,
  ])
  return { draft, targetRestored }
}

function useSessionComposerSend(input: {
  draft: ReturnType<typeof useDurableComposerDraft>
  identity: ComposerIdentity
  projectId: string | null
}) {
  const navigate = useNavigate()
  return async (
    prompt: string,
    turnConfiguration: TurnConfiguration | null,
    attachments: DraftContent['attachments'],
  ) => {
    const sessionId = (await input.draft?.submit(prompt, turnConfiguration, attachments)) ?? null
    if (sessionId === null) return false
    if (input.identity.kind === 'draft' && input.projectId !== null)
      navigate(`/projects/${input.projectId}/sessions/${sessionId}`, { replace: true })
    return true
  }
}

function useCatalogRead(harness: HarnessControl) {
  const catalogQuery = useQuery(trpc.harnessCatalogRead.queryOptions({ harness: harness.harness }))
  const catalogRefresh = useMutation(trpc.harnessCatalogRefresh.mutationOptions())
  const refreshCatalog = () =>
    catalogRefresh.mutate(
      { harness: harness.harness },
      { onSettled: () => void catalogQuery.refetch() },
    )
  return { catalogQuery, refreshCatalog }
}

function useComposerRetryFocus(
  catalogQuery: ReturnType<typeof useCatalogRead>['catalogQuery'],
  draft: ReturnType<typeof useDurableComposerDraft>,
) {
  const [focusComposerAfterRetry, setFocusComposerAfterRetry] = useState(false)
  const clearRecoveryFocus = useCallback(() => setFocusComposerAfterRetry(false), [])
  const focusAfterSuccessfulRetry = (retry: Promise<{ isSuccess: boolean }>) => {
    void retry.then(({ isSuccess }) => {
      if (isSuccess) setFocusComposerAfterRetry(true)
    })
  }
  const retryCatalog = () => focusAfterSuccessfulRetry(catalogQuery.refetch())
  const retryDraft = () => draft && focusAfterSuccessfulRetry(draft.retryLoad())
  return { focusComposerAfterRetry, clearRecoveryFocus, retryCatalog, retryDraft }
}

function useSessionInterrupt(selectedSessionId: string | null, harness: HarnessControl) {
  const { mutateAsync: interrupt } = useMutation(trpc.sessionInterrupt.mutationOptions())
  if (selectedSessionId === null || harness.harness !== 'claude') return undefined
  return async () => {
    try {
      await interrupt({ sessionId: selectedSessionId })
      return true
    } catch {
      return false
    }
  }
}

// The Session list already knows another process runs it live, so no Send is offered at all (ADR-0040).
export function SessionComposerArea({
  permission,
  questionPending,
  liveStatus,
  session,
  harness,
  selectedSessionId,
  sessionList,
  cockpit,
  workspaceCockpit,
  workspaceActions,
}: SessionScreenDetailsProps) {
  const { catalogQuery, refreshCatalog } = useCatalogRead(harness)
  const location = useLocation()
  const { catalogFailure, choices, initialTurnConfiguration, identity } =
    sessionComposerConfiguration({
      selectedSessionId,
      projectId: cockpit.project?.id ?? null,
      sessionList,
      catalogResult: catalogQuery.data,
      catalogFailed: catalogQuery.isError,
    })
  const composerKey = composerIdentityKey(identity)
  const { draft, targetRestored } = useSessionComposerDraft({
    identity,
    harness,
    cockpit,
    workspaceCockpit,
    workspaceActions,
    choices,
    opening: initialTurnConfiguration,
  })
  const { focusComposerAfterRetry, clearRecoveryFocus, retryCatalog, retryDraft } =
    useComposerRetryFocus(catalogQuery, draft)
  const onInterrupt = useSessionInterrupt(selectedSessionId, harness)
  if (session?.locked === true) return <OpenElsewhere onRetry={null} />
  if (draft === null)
    return (
      <ComposerLoadFallback
        sessionId={`${composerKey}:loading`}
        harness={harness}
        choices={choices}
        opening={initialTurnConfiguration}
        catalogFailure={catalogFailure}
        onRetryCatalog={retryCatalog}
      />
    )
  if (!targetRestored && !draft.loadFailed) return null
  return (
    <ReadySessionComposer
      {...{ permission, questionPending, session, harness, workspaceCockpit, workspaceActions }}
      isRunning={liveStatus === 'running' || liveStatus === 'permission' || liveStatus === 'asking'}
      onInterrupt={onInterrupt}
      catalogFailure={catalogFailure}
      choices={choices}
      composerKey={composerKey}
      draft={draft}
      focusOnMount={location.state === COMPOSER_FOCUS_STATE || focusComposerAfterRetry}
      onFocusAfterMount={clearRecoveryFocus}
      identity={identity}
      onRefreshCatalog={refreshCatalog}
      onRetryCatalog={retryCatalog}
      onRetryDraft={retryDraft}
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
  onFocusAfterMount,
  identity,
  onRefreshCatalog,
  onRetryCatalog,
  onRetryDraft,
  isRunning,
  onInterrupt,
}: Pick<
  SessionScreenDetailsProps,
  'permission' | 'questionPending' | 'session' | 'harness' | 'workspaceCockpit' | 'workspaceActions'
> & {
  catalogFailure: CatalogFailure | null
  choices: Parameters<typeof useDurableComposerDraft>[0]['choices']
  composerKey: string
  draft: NonNullable<ReturnType<typeof useDurableComposerDraft>>
  focusOnMount: boolean
  onFocusAfterMount: () => void
  identity: ComposerIdentity
  onRefreshCatalog: () => void
  onRetryCatalog: () => void
  onRetryDraft: () => void
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
}) {
  const { t } = useTranslation('sessions')
  const onSend = useSessionComposerSend({
    draft,
    identity,
    projectId: identity.kind === 'draft' ? identity.projectId : null,
  })
  return (
    <>
      {permission.failure ? <Failure message={permission.failure} /> : null}
      {catalogFailure ? (
        <Failure
          message={catalogFailureMessage(t, harness.harness, catalogFailure)}
          onRetry={onRetryCatalog}
        />
      ) : null}
      {draft.loadFailed ? <DraftLoadFailure onRetry={onRetryDraft} /> : null}
      {draft.saveFailed ? <Failure message={t('composer.draftSaveFailed')} /> : null}
      {draft.sendFailed ? <Failure message={t('composer.sendFailed')} /> : null}
      <ComposerForm
        sessionId={`${composerKey}:${draft.hasDraft ? 'ready' : 'load-failed'}`}
        initialEditing={draft.initialEditing}
        onEditingChange={draft.onEditingChange}
        focusOnMount={focusOnMount}
        onFocusAfterMount={onFocusAfterMount}
        turnConfigurationChoices={choices}
        catalogFailure={catalogFailure}
        refreshCatalog={onRefreshCatalog}
        workspace={workspaceControl(identity, workspaceCockpit, workspaceActions)}
        contextTokens={session?.contextTokens}
        contextWindowTokens={session?.contextWindowTokens}
        disabled={questionPending || (draft.loadFailed && !draft.hasDraft)}
        harness={harness}
        permissionPrompt={
          <PermissionPrompt
            harness={harness.harness}
            headingLevel={2}
            permission={permission.permission}
            onDecide={permission.decide}
          />
        }
        plan={session?.plan ?? null}
        onSend={onSend}
        isRunning={isRunning}
        onInterrupt={onInterrupt}
      />
    </>
  )
}

export function ComposerLoadFallback({
  sessionId,
  harness,
  choices,
  opening,
  catalogFailure,
  onRetryCatalog,
}: {
  sessionId: string
  harness: HarnessControl
  choices: Parameters<typeof useDurableComposerDraft>[0]['choices']
  opening: TurnConfiguration | null
  catalogFailure: CatalogFailure | null
  onRetryCatalog: () => void
}) {
  const { t } = useTranslation('sessions')
  const message = catalogFailure
    ? catalogFailureMessage(t, harness.harness, catalogFailure)
    : t('composer.loading')
  return (
    <>
      <Failure
        message={message}
        onRetry={catalogFailure ? onRetryCatalog : undefined}
        status={!catalogFailure}
      />
      <ComposerForm
        sessionId={sessionId}
        initialEditing={opening === null ? undefined : { turnConfiguration: opening }}
        disabled
        harness={harness}
        turnConfigurationChoices={choices}
        catalogFailure={catalogFailure}
        refreshCatalog={onRetryCatalog}
      />
    </>
  )
}

function handoffTitle(sessionList: SessionListPage | null, sessionId: string) {
  const row = sessionList?.sessions.find(({ id }) => id === sessionId)
  return row?.title?.text ?? sessionId
}

export function DraftLoadFailure({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('sessions')
  return <Failure message={t('composer.draftLoadFailed')} onRetry={onRetry} />
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

function Failure({
  message,
  onRetry,
  status = false,
}: {
  message: string
  onRetry?: () => void
  status?: boolean
}) {
  const { t } = useTranslation('sessions')
  return (
    <div className={`${COMPOSER_COLUMN} mt-3`}>
      <Alert role={status ? 'status' : 'alert'} variant={status ? 'default' : 'destructive'}>
        <AlertDescription>{message}</AlertDescription>
        {onRetry ? (
          <AlertAction>
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              {t('composer.retry')}
            </Button>
          </AlertAction>
        ) : null}
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
