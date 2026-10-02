import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { ProjectsState } from '@/domains/projects/renderer'
import { pendingSessionId } from '@/domains/sessions/api/pending-session'
import type { Harness } from '@/harnesses/harness'
import type { CatalogReadResult } from '@/harnesses/harness-catalog'
import { harnessLabel } from '@/harnesses/presentation-registry'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import { type RouterInputs, trpc } from '@/platform/renderer/trpc-client'
import type { CatalogFailure, WorktreeOptionsActions, WorktreeOptionsState } from '../composer'
import {
  ComposerForm,
  type ComposerFormProps,
  type ComposerIdentity,
  composerIdentityKey,
  composerIdentityOf,
  type DraftContent,
  type DraftSubmitFailure,
  PLAIN_REJECTION,
  type TurnConfiguration,
  initialTurnConfiguration as turnConfigurationFor,
  useDurableComposerDraft,
} from '../composer'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { type HarnessControl, useAvailableHarnesses } from '../harness'
import { SessionTitle } from '../prompt'
import type { ComposerPlan, Session, SessionExtras } from '../types'
import { draftTarget } from './session-draft-target'
import type { SentConfiguration } from './session-screen-state'
import { type ComposerFailure, useComposerFailureToasts } from './use-composer-failure-toasts'
import { useTellWorktreeGone } from './use-gone-worktree'
import { useSessionDetails } from './use-session-details'

type SessionScreenDetailsProps = {
  permission: ReturnType<typeof import('../composer').useSessionPermission>
  questionPending: boolean
  liveStatus: ReturnType<typeof import('../feed').useFeedReading>['liveStatus']
  session: (Session & SessionExtras) | null
  harness: HarnessControl | null
  selectedSessionId: string | null
  // Whether the selected Session's details have been read, so its composer can open on them.
  sessionLoaded: boolean
  projectState: ProjectsState
  worktreeState: WorktreeOptionsState
  worktreeActions: WorktreeOptionsActions
  // What this window's Send started the selected Session with, until its details load.
  sent: SentConfiguration | null
  // A new Session's pending id from its saved prompt, and the Session route that draws it.
  onStartingSession: (
    pendingId: string | null,
    sessionId?: string,
    sent?: SentConfiguration,
  ) => void
}

type SessionsTranslator = ReturnType<typeof useTranslation<'sessions'>>['t']

// The open Feed's steps, else the stored row's step count.
function composerPlan(session: (Session & SessionExtras) | null): ComposerPlan | null {
  if (session?.plan?.state === 'available') return session.plan
  if (session?.planProgress == null) return session?.plan ?? null
  return { state: 'counted', ...session.planProgress }
}

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
  if (info?.availability !== 'unavailable') return null
  return 'installStep' in info
    ? { reason: info.reason, installStep: info.installStep }
    : { reason: info.reason, detail: info.detail }
}

function sessionComposerConfiguration(input: {
  selectedSessionId: string | null
  projectId: string | null
  session: (Session & SessionExtras) | null
  sessionLoaded: boolean
  catalogResult: CatalogReadResult | undefined
  catalogFailed: boolean
  sent: SentConfiguration | null
}) {
  const catalog = input.catalogResult?.info ?? null
  const catalogFailure = catalogFailureOf(input.catalogResult, input.catalogFailed)
  const identity = composerIdentityOf(input.selectedSessionId, input.projectId)
  const choices = catalog?.availability === 'available' ? catalog : null
  const loadedConfiguration =
    choices === null || (identity.kind === 'session' && !input.sessionLoaded)
      ? null
      : turnConfigurationFor(choices, { identity, session: input.session })
  // A new Session's chip keeps what its Send used until the details load (#3179).
  const initialTurnConfiguration = loadedConfiguration ?? input.sent?.turnConfiguration ?? null
  return { catalogFailure, choices, initialTurnConfiguration, identity }
}

// A draft has no Turn to ask about, so its tray holds the Worktree row instead of a permission.
function composerTray(input: {
  identity: ReturnType<typeof composerIdentityOf>
  harness: HarnessControl | null
  permission: SessionScreenDetailsProps['permission']
  worktree: WorktreeOptionsState
  actions: WorktreeOptionsActions
}): Pick<ComposerFormProps, 'worktree' | 'permissionPrompt'> {
  const { identity, harness, permission, worktree, actions } = input
  if (identity.kind === 'draft')
    return { worktree: { ...worktree, ...actions }, permissionPrompt: null }
  return {
    worktree: null,
    permissionPrompt: (
      <PermissionPrompt
        harness={harness?.harness}
        headingLevel={2}
        permission={permission.permission}
        onDecide={permission.decide}
      />
    ),
  }
}

// Restores a saved draft's switch; its start is never restored. False while the options load.
function restoreSwitch(
  saved: Extract<RouterInputs['composerDraftCreate']['target'], { type: 'project' }>['worktree'],
  worktree: Pick<WorktreeOptionsState, 'options' | 'newWorktree'>,
  setNewWorktree: (newWorktree: boolean) => void,
): boolean {
  if (worktree.options === null) return false
  const newWorktree = saved.type === 'new'
  if (newWorktree !== worktree.newWorktree) setNewWorktree(newWorktree)
  return true
}

// The saved Harness to switch to, or null to keep the current one. One that cannot start a Session
// stays unpicked (#3005); 'unknown' means availability is still being read.
function rememberedHarness(
  current: Harness,
  saved: Harness,
  available: readonly Harness[] | null,
): Harness | 'unknown' | null {
  if (current === saved) return null
  if (available === null) return 'unknown'
  return available.includes(saved) ? saved : null
}

function useSessionComposerDraft(input: {
  identity: ComposerIdentity
  harness: HarnessControl | null
  projectState: ProjectsState
  worktreeState: WorktreeOptionsState
  worktreeActions: WorktreeOptionsActions
  choices: Parameters<typeof useDurableComposerDraft>[0]['choices']
  opening: TurnConfiguration | null
}) {
  const { identity, harness, projectState, worktreeState, worktreeActions, choices, opening } =
    input
  const target = draftTarget({
    identity,
    harness,
    projectId: projectState.project?.id ?? null,
    worktree: worktreeState,
  })
  const [restoredProjectId, setRestoredProjectId] = useState<string | null>(null)
  const availableHarnesses = useAvailableHarnesses()
  const projectId = identity.kind === 'draft' ? identity.projectId : null
  // Opening a Session forgets the restore, so the next new-Session composer restores its target.
  if (projectId === null && restoredProjectId !== null) setRestoredProjectId(null)
  const targetRestored = identity.kind === 'session' || restoredProjectId === projectId
  const draft = useDurableComposerDraft({ target, choices, opening, targetRestored })
  const loadedTarget = draft?.loadedTarget
  const pickedHarness = harness?.harness
  const changeHarness = harness?.onChange
  useEffect(() => {
    const nothingToRestore = restoredProjectId === projectId || loadedTarget === undefined
    if (projectId === null || pickedHarness === undefined || nothingToRestore) return
    if (loadedTarget === null) {
      setRestoredProjectId(projectId)
      return
    }
    if (loadedTarget.type !== 'project' || loadedTarget.projectId !== projectId) return
    const remembered = rememberedHarness(pickedHarness, loadedTarget.harness, availableHarnesses)
    if (remembered === 'unknown') return
    if (remembered !== null) {
      changeHarness?.(remembered)
      return
    }
    if (!restoreSwitch(loadedTarget.worktree, worktreeState, worktreeActions.setNewWorktree)) return
    setRestoredProjectId(projectId)
  }, [
    availableHarnesses,
    changeHarness,
    loadedTarget,
    pickedHarness,
    projectId,
    restoredProjectId,
    worktreeActions,
    worktreeState,
  ])
  return { draft, targetRestored }
}

function useSessionComposerSend(input: {
  draft: ReturnType<typeof useDurableComposerDraft>
  identity: ComposerIdentity
  harness: HarnessControl | null
  projectId: string | null
  onFailure: (failure: DraftSubmitFailure) => void
  onStartingSession: SessionScreenDetailsProps['onStartingSession']
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const tellWorktreeGone = useTellWorktreeGone()
  return async (
    prompt: string,
    turnConfiguration: TurnConfiguration | null,
    attachments: DraftContent['attachments'],
  ) => {
    let pendingId = null as string | null
    const onSaved = (saved: { id: string; revision: number }) => {
      pendingId = pendingSessionId(saved)
      input.onStartingSession(pendingId)
    }
    const result = await input.draft?.submit({
      prompt,
      turnConfiguration,
      attachments,
      ...(input.identity.kind === 'draft' ? { onSaved } : {}),
    })
    if (result?.outcome !== 'accepted') {
      input.onStartingSession(null)
      const failure = result ?? PLAIN_REJECTION
      input.onFailure(failure)
      return failure.outcome
    }
    // The worktree folder went after the Session opened, so main moved it at Send.
    if (result.worktreeGone !== null) tellWorktreeGone(result.worktreeGone)
    if (input.identity.kind === 'draft' && input.projectId !== null) {
      void queryClient.invalidateQueries({
        queryKey: trpc.worktreeOptions.queryKey({ projectId: input.projectId }),
      })
      // The named Session draws the prompt until its own Feed shows it, whatever the Harness.
      const harness = input.harness?.harness
      const sent =
        harness === undefined || turnConfiguration === null
          ? undefined
          : { harness, turnConfiguration }
      input.onStartingSession(pendingId, result.sessionId, sent)
      navigate(`/projects/${input.projectId}/sessions/${result.sessionId}`, { replace: true })
    }
    return 'accepted'
  }
}

// No Harness means an open Session whose details have not loaded, so there is no catalog to read.
function useCatalogRead(harness: HarnessControl | null) {
  const queryClient = useQueryClient()
  const catalogQuery = useQuery(
    trpc.harnessCatalogRead.queryOptions(
      harness === null ? skipToken : { harness: harness.harness },
    ),
  )
  const catalogRefresh = useMutation(trpc.harnessCatalogRefresh.mutationOptions())
  const refreshCatalog = () =>
    harness !== null &&
    catalogRefresh.mutate(
      { harness: harness.harness },
      {
        // The refresh answers with the new catalog, so a second read would only load it again.
        onSuccess: (result) =>
          queryClient.setQueryData(
            trpc.harnessCatalogRead.queryKey({ harness: harness.harness }),
            result,
          ),
        onError: () => void catalogQuery.refetch(),
      },
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
  sessionLoaded,
  projectState,
  worktreeState,
  worktreeActions,
  sent,
  onStartingSession,
}: SessionScreenDetailsProps) {
  const { catalogQuery, refreshCatalog } = useCatalogRead(harness)
  const location = useLocation()
  const { catalogFailure, choices, initialTurnConfiguration, identity } =
    sessionComposerConfiguration({
      selectedSessionId,
      projectId: projectState.project?.id ?? null,
      session,
      sessionLoaded,
      catalogResult: catalogQuery.data,
      catalogFailed: catalogQuery.isError,
      sent,
    })
  const composerKey = composerIdentityKey(identity)
  const { draft, targetRestored } = useSessionComposerDraft({
    identity,
    harness,
    projectState,
    worktreeState,
    worktreeActions,
    choices,
    opening: initialTurnConfiguration,
  })
  const { focusComposerAfterRetry, clearRecoveryFocus, retryCatalog, retryDraft } =
    useComposerRetryFocus(catalogQuery, draft)
  const onInterrupt = useSessionInterrupt(selectedSessionId)
  return (
    <SessionComposer
      {...{ permission, questionPending, session, harness, worktreeState, worktreeActions }}
      projectId={projectState.project?.id ?? null}
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
      onStartingSession={onStartingSession}
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
  worktreeState,
  worktreeActions,
  catalogFailure,
  choices,
  composerKey,
  draft,
  opening,
  focusOnMount,
  onFocusAfterMount,
  identity,
  projectId,
  onRefreshCatalog,
  onRetryCatalog,
  onRetryDraft,
  isRunning,
  onInterrupt,
  onStartingSession,
}: Pick<
  SessionScreenDetailsProps,
  | 'permission'
  | 'questionPending'
  | 'session'
  | 'harness'
  | 'worktreeState'
  | 'worktreeActions'
  | 'onStartingSession'
> & {
  catalogFailure: CatalogFailure | null
  choices: Parameters<typeof useDurableComposerDraft>[0]['choices']
  composerKey: string
  draft: LoadedDraft | null
  opening: TurnConfiguration | null
  focusOnMount: boolean
  onFocusAfterMount: () => void
  identity: ComposerIdentity
  projectId: string | null
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
    harness,
    projectId: identity.kind === 'draft' ? identity.projectId : null,
    onFailure: reportSendFailure,
    onStartingSession,
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
    ...composerTray({
      identity,
      harness,
      permission,
      worktree: worktreeState,
      actions: worktreeActions,
    }),
    // #2968 fills context usage.
    contextTokens: session?.contextTokens,
    contextWindowTokens: session?.contextWindowTokens,
    disabled: questionPending || catalogBlocked || (draft?.loadFailed === true && !draft.hasDraft),
    harness,
    plan: composerPlan(session),
    projectId,
    commandCwd:
      identity.kind === 'session'
        ? (session?.cwd ?? null)
        : (worktreeState.options?.checkout.path ?? null),
    liveSessionId: identity.kind === 'session' ? identity.sessionId : null,
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
  harness: HarnessControl | null
  onRetryCatalog: () => void
  onRetryDraft: () => void
  permissionFailure: string | null
}) {
  const { t } = useTranslation('sessions')
  const owner = input.composerKey
  const catalog = `catalog:${input.harness?.harness ?? 'none'}`
  const failures: ComposerFailure[] = []
  if (input.permissionFailure) failures.push({ scope: owner, title: input.permissionFailure })
  if (input.catalogFailure && input.harness)
    failures.push({
      scope: catalog,
      title: catalogFailureMessage(t, input.harness.harness, input.catalogFailure),
      retry: input.onRetryCatalog,
    })
  if (input.draft?.loadFailed)
    failures.push({ scope: owner, title: t('composer.draftLoadFailed'), retry: input.onRetryDraft })
  if (input.draft?.saveFailed) failures.push({ scope: owner, title: t('composer.draftSaveFailed') })
  const report = useComposerFailureToasts(failures, [owner, catalog])
  return (failure: DraftSubmitFailure) =>
    report({ scope: owner, title: sendFailureMessage(t, input.harness?.harness ?? null, failure) })
}

function sendFailureMessage(
  t: SessionsTranslator,
  harness: Harness | null,
  failure: DraftSubmitFailure,
) {
  if (failure.outcome === 'uncertain') return t('composer.sendUncertain')
  if (failure.reason === null || harness === null) return t('composer.sendFailed')
  return t(`composer.sendRejected.${failure.reason}`, { harness: harnessLabel(harness) })
}

// A handoff names its other Session by ID, which the Session list need not have loaded.
function HandoffLink({
  label,
  sessionId,
  onNavigate,
}: {
  label: string
  sessionId: string
  onNavigate: (path: string) => void
}) {
  const { projectId } = useParams()
  const { session } = useSessionDetails(sessionId)
  return (
    <p className="mt-2">
      {label}{' '}
      <button
        className="text-foreground underline underline-offset-2"
        onClick={() => onNavigate(`/projects/${projectId}/sessions/${sessionId}`)}
        type="button"
      >
        {session === null ? sessionId : <SessionTitle session={session} />}
      </button>
    </p>
  )
}

export function SessionHandoffFacts({
  session,
  onNavigate,
}: Pick<SessionScreenDetailsProps, 'session'> & {
  onNavigate?: (path: string) => void
}) {
  const { t } = useTranslation('sessions')
  // #2969 fills the handoff links.
  if (session === null || (!session.handoffTo && !session.handoffFrom) || !onNavigate) return null
  return (
    <section aria-label={t('handoff.label')} className="p-4 type-meta text-muted-foreground">
      <h2 className="font-medium text-foreground">{t('handoff.title')}</h2>
      {session.handoffTo ? (
        <HandoffLink
          label={t('handoff.to')}
          onNavigate={onNavigate}
          sessionId={session.handoffTo}
        />
      ) : null}
      {session.handoffFrom ? (
        <HandoffLink
          label={t('handoff.from')}
          onNavigate={onNavigate}
          sessionId={session.handoffFrom}
        />
      ) : null}
    </section>
  )
}
