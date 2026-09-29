import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer'
import type { WorkspaceActions, WorkspaceCockpit } from '@/domains/workspaces/renderer'
import type { CatalogReadResult } from '@/harnesses/harness-catalog'
import { harnessLabel } from '@/harnesses/presentation-registry'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import { trpc } from '@/platform/renderer/trpc-client'
import {
  type DraftContent,
  useDurableComposerDraft,
} from '../composer/draft/use-durable-composer-draft'
import {
  type ComposerIdentity,
  composerIdentityKey,
  composerIdentityOf,
} from '../composer/identity/composer-identity'
import { ComposerForm, type ComposerFormProps } from '../composer/layout/composer-form'
import type { CatalogFailure } from '../composer/toolbar/turn-configuration-menu'
import {
  type TurnConfiguration,
  initialTurnConfiguration as turnConfigurationFor,
} from '../composer/turn-configuration/turn-configuration'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import type { HarnessControl } from '../harness/harnesses'
import type { Session, SessionListPage } from '../types'
import { draftTarget } from './session-draft-target'
import { type ComposerFailure, useComposerFailureToasts } from './use-composer-failure-toasts'

type SessionScreenDetailsProps = {
  permission: ReturnType<typeof import('../composer').useSessionPermission>
  questionPending: boolean
  liveStatus: ReturnType<typeof import('../feed/use-feed-reading').useFeedReading>['liveStatus']
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
    harness: harnessLabel(harness),
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
    choice: workspaces.choice,
    saveFailed: workspaces.saveFailed,
    onSelect: actions.selectWorkspace,
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
  const target = draftTarget({
    identity,
    harness,
    projectId: cockpit.project?.id ?? null,
    workspace: workspaceCockpit,
  })
  const [restoredProjectId, setRestoredProjectId] = useState<string | null>(null)
  const projectId = identity.kind === 'draft' ? identity.projectId : null
  // Opening a Session forgets the restore, so the next new-Session composer restores its target.
  if (projectId === null && restoredProjectId !== null) setRestoredProjectId(null)
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
    if (harness.harness !== loadedTarget.harness) {
      harness.onChange?.(loadedTarget.harness)
      return
    }
    const savedChoice = loadedTarget.workspaceId ?? 'new'
    if (workspaceCockpit.choice !== savedChoice) workspaceActions.selectWorkspace(savedChoice)
    setRestoredProjectId(projectId)
  }, [
    harness.harness,
    harness.onChange,
    loadedTarget,
    projectId,
    restoredProjectId,
    workspaceActions,
    workspaceCockpit.choice,
  ])
  return { draft, targetRestored }
}

function useSessionComposerSend(input: {
  draft: ReturnType<typeof useDurableComposerDraft>
  identity: ComposerIdentity
  projectId: string | null
  onFailure: (outcome: 'rejected' | 'uncertain') => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return async (
    prompt: string,
    turnConfiguration: TurnConfiguration | null,
    attachments: DraftContent['attachments'],
  ) => {
    const result = await input.draft?.submit(prompt, turnConfiguration, attachments)
    if (result?.outcome !== 'accepted') {
      const outcome = result?.outcome ?? 'rejected'
      input.onFailure(outcome)
      return outcome
    }
    if (input.identity.kind === 'draft' && input.projectId !== null) {
      void queryClient.invalidateQueries({
        queryKey: trpc.workspaceList.queryKey({ projectId: input.projectId }),
      })
      navigate(`/projects/${input.projectId}/sessions/${result.sessionId}`, { replace: true })
    }
    return 'accepted'
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

function useSessionInterrupt(selectedSessionId: string | null) {
  const { mutateAsync: interrupt } = useMutation(trpc.sessionInterrupt.mutationOptions())
  if (selectedSessionId === null) return undefined
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
  const onInterrupt = useSessionInterrupt(selectedSessionId)
  return (
    <SessionComposer
      {...{ permission, questionPending, session, harness, workspaceCockpit, workspaceActions }}
      isRunning={liveStatus === 'running' || liveStatus === 'permission' || liveStatus === 'asking'}
      onInterrupt={onInterrupt}
      catalogFailure={catalogFailure}
      choices={choices}
      composerKey={composerKey}
      draft={draft !== null && (targetRestored || draft.loadFailed) ? draft : null}
      opening={initialTurnConfiguration}
      focusOnMount={location.state === COMPOSER_FOCUS_STATE || focusComposerAfterRetry}
      onFocusAfterMount={clearRecoveryFocus}
      identity={identity}
      onRefreshCatalog={refreshCatalog}
      onRetryCatalog={retryCatalog}
      onRetryDraft={retryDraft}
    />
  )
}

type LoadedDraft = NonNullable<ReturnType<typeof useDurableComposerDraft>>

function initialFormEditing(draft: LoadedDraft | null, opening: TurnConfiguration | null) {
  if (draft !== null) return draft.initialEditing
  return opening === null ? undefined : { turnConfiguration: opening }
}

// One card at one place in the tree while a draft loads and after, so a Session switch swaps its
// content instead of mounting a new card (#2836). The owner's editor mounts at once, empty and
// inert but drawn enabled, and its draft fills in when it loads.
function SessionComposer({
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
  opening,
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
  draft: LoadedDraft | null
  opening: TurnConfiguration | null
  focusOnMount: boolean
  onFocusAfterMount: () => void
  identity: ComposerIdentity
  onRefreshCatalog: () => void
  onRetryCatalog: () => void
  onRetryDraft: () => void
  isRunning: boolean
  onInterrupt?: () => Promise<boolean>
}) {
  const reportSendFailure = useComposerFailures({
    catalogFailure,
    composerKey,
    draft,
    harness,
    onRetryCatalog,
    onRetryDraft,
    permissionFailure: permission.failure,
  })
  const onSend = useSessionComposerSend({
    draft,
    identity,
    projectId: identity.kind === 'draft' ? identity.projectId : null,
    onFailure: reportSendFailure,
  })
  const waiting = draft?.hasDraft !== true
  // A failed catalog leaves no draft to wait for: the card disables, and its catalog menu can retry.
  const catalogBlocked = waiting && catalogFailure !== null
  const form: ComposerFormProps = {
    sessionId: composerKey,
    loading: waiting && !catalogBlocked,
    initialEditing: initialFormEditing(draft, opening),
    onEditingChange: draft?.onEditingChange,
    focusOnMount,
    onFocusAfterMount,
    turnConfigurationChoices: choices,
    catalogFailure,
    refreshCatalog: draft === null ? onRetryCatalog : onRefreshCatalog,
    workspace: workspaceControl(identity, workspaceCockpit, workspaceActions),
    contextTokens: session?.contextTokens,
    contextWindowTokens: session?.contextWindowTokens,
    disabled: questionPending || catalogBlocked || (draft?.loadFailed === true && !draft.hasDraft),
    harness,
    permissionPrompt: (
      <PermissionPrompt
        harness={harness.harness}
        headingLevel={2}
        permission={permission.permission}
        onDecide={permission.decide}
      />
    ),
    plan: session?.plan ?? null,
    onSend,
    isRunning,
    onInterrupt,
  }
  return <ComposerForm {...form} />
}

// Failures toast instead of drawing above the composer, so an error never moves the card (#2836).
function useComposerFailures(input: {
  catalogFailure: CatalogFailure | null
  composerKey: string
  draft: LoadedDraft | null
  harness: HarnessControl
  onRetryCatalog: () => void
  onRetryDraft: () => void
  permissionFailure: string | null
}) {
  const { t } = useTranslation('sessions')
  const owner = input.composerKey
  const catalog = `catalog:${input.harness.harness}`
  const failures: ComposerFailure[] = []
  if (input.permissionFailure) failures.push({ scope: owner, title: input.permissionFailure })
  if (input.catalogFailure)
    failures.push({
      scope: catalog,
      title: catalogFailureMessage(t, input.harness.harness, input.catalogFailure),
      retry: input.onRetryCatalog,
    })
  if (input.draft?.loadFailed)
    failures.push({ scope: owner, title: t('composer.draftLoadFailed'), retry: input.onRetryDraft })
  if (input.draft?.saveFailed) failures.push({ scope: owner, title: t('composer.draftSaveFailed') })
  const report = useComposerFailureToasts(failures, [owner, catalog])
  return (outcome: 'rejected' | 'uncertain') =>
    report({
      scope: owner,
      title: t(outcome === 'rejected' ? 'composer.sendFailed' : 'composer.sendUncertain'),
    })
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
