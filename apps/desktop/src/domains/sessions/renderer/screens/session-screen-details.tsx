import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer'
import { attachmentKindOf } from '@/domains/sessions/api/attachments'
import type { SessionRosterRow } from '@/domains/sessions/renderer/model/models'
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
import { type RouterInputs, type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'
import { useComposerStore } from '../composer/hooks/use-composer-store'
import {
  type ComposerIdentity,
  composerIdentityKey,
  composerIdentityOf,
} from '../composer/identity/composer-identity'
import { COMPOSER_COLUMN, ComposerForm } from '../composer/layout/composer-form'
import type { CatalogFailure } from '../composer/toolbar/turn-configuration-menu'
import { useTurnConfiguration } from '../composer/turn-configuration/use-turn-configuration'
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

function draftOwnerKey(target: RouterInputs['composerDraftCreate']['target'] | null) {
  if (target === null) return null
  return target.type === 'project' ? `project:${target.projectId}` : `session:${target.sessionId}`
}

function hydrateComposerStore(
  composerKey: string,
  draft: NonNullable<RouterOutputs['composerDraftRead']>,
) {
  useComposerStore.setState((state) => ({
    harness: draft.target.type === 'project' ? draft.target.harness : state.harness,
    drafts: { ...state.drafts, [composerKey]: draft.prompt },
    attachments: {
      ...state.attachments,
      [composerKey]: draft.attachments.map((attachment, index) => ({
        id: `${draft.id}:${index}`,
        path: attachment.path,
        status: 'idle',
      })),
    },
    tickets: { ...state.tickets, [composerKey]: draft.ticketContext },
    turnConfiguration: {
      ...state.turnConfiguration,
      [composerKey]: draft.turnConfiguration,
    },
  }))
}

type DurableComposerDraftInput = {
  target: RouterInputs['composerDraftCreate']['target'] | null
  composerKey: string
  turnConfiguration: RouterInputs['composerDraftCreate']['content']['turnConfiguration'] | null
}

function durableDraftContent(input: {
  prompt: string
  attachments: ReturnType<typeof useComposerStore.getState>['attachments'][string] | undefined
  ticketContext: ReturnType<typeof useComposerStore.getState>['tickets'][string] | undefined
  turnConfiguration: DurableComposerDraftInput['turnConfiguration']
}) {
  if (input.turnConfiguration === null) return null
  return {
    prompt: input.prompt,
    attachments: (input.attachments ?? []).map(({ path: attachmentPath }) => ({
      path: attachmentPath,
      kind: attachmentKindOf(attachmentPath),
    })),
    ticketContext: input.ticketContext ?? [],
    turnConfiguration: input.turnConfiguration,
  }
}

function useDurableComposerDraft({
  target,
  composerKey,
  turnConfiguration,
}: DurableComposerDraftInput) {
  const queryInput = target ?? { type: 'session' as const, sessionId: 'disabled' }
  const query = useQuery({
    ...trpc.composerDraftRead.queryOptions(queryInput),
    enabled: target !== null,
  })
  const createDraft = useMutation(trpc.composerDraftCreate.mutationOptions())
  const saveDraft = useMutation(trpc.composerDraftSave.mutationOptions())
  const [hydratedOwner, setHydratedOwner] = useState<string | null>(null)
  const persisted = useRef<{ id: string; revision: number; owner: string } | null>(null)
  const saveChain = useRef(Promise.resolve())
  const prompt = useComposerStore(({ drafts }) => drafts[composerKey] ?? '')
  const storedAttachments = useComposerStore(({ attachments }) => attachments[composerKey])
  const ticketContext = useComposerStore(({ tickets }) => tickets[composerKey])
  const owner = draftOwnerKey(target)
  const content = useMemo(
    () =>
      durableDraftContent({
        prompt,
        attachments: storedAttachments,
        ticketContext,
        turnConfiguration,
      }),
    [prompt, storedAttachments, ticketContext, turnConfiguration],
  )

  useEffect(() => {
    if (target === null || owner === null || content === null || query.isPending) return
    if (persisted.current?.owner === owner) return
    let current = true
    void (async () => {
      const draft = query.data ?? (await createDraft.mutateAsync({ target, content }))
      if (!current) return
      hydrateComposerStore(composerKey, draft)
      persisted.current = { id: draft.id, revision: draft.revision, owner }
      setHydratedOwner(owner)
    })().catch(() => setHydratedOwner(owner))
    return () => {
      current = false
    }
  }, [composerKey, content, createDraft, owner, query.data, query.isPending, target])

  useEffect(() => {
    const stored = persisted.current
    if (target === null || owner === null || content === null || stored?.owner !== owner) return
    const timeout = window.setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => {
        const latest = persisted.current
        if (latest?.owner !== owner) return
        const saved = await saveDraft.mutateAsync({
          id: latest.id,
          expectedRevision: latest.revision,
          target,
          content,
        })
        persisted.current = { id: saved.id, revision: saved.revision, owner }
      })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [content, owner, saveDraft, target])

  return target === null || hydratedOwner === owner
}

async function submitFromComposer({
  createDraft,
  saveDraft,
  submit,
  identity,
  harness,
  cockpit,
  workspace,
  prompt,
  turnConfiguration,
  attachments,
}: {
  createDraft: (
    input: RouterInputs['composerDraftCreate'],
  ) => Promise<RouterOutputs['composerDraftCreate']>
  saveDraft: (
    input: RouterInputs['composerDraftSave'],
  ) => Promise<RouterOutputs['composerDraftSave']>
  submit: (input: RouterInputs['sessionSubmit']) => Promise<{ sessionId: string }>
  identity: ReturnType<typeof composerIdentityOf>
  harness: HarnessControl
  cockpit: Cockpit
  workspace: WorkspaceCockpit
  prompt: string
  turnConfiguration: RouterInputs['composerDraftCreate']['content']['turnConfiguration'] | null
  attachments: RouterInputs['composerDraftCreate']['content']['attachments']
}) {
  if (turnConfiguration === null) return false
  const target = draftTarget({ identity, harness, cockpit, workspace })
  if (target === null) return false
  const commandId =
    identity.kind === 'pending'
      ? useSessionCreationStore.getState().startSubmission(identity.sessionId, prompt)
      : crypto.randomUUID()
  if (commandId === null) return false
  try {
    const composerKey = composerIdentityKey(identity)
    const draftContent = {
      prompt,
      attachments,
      ticketContext: useComposerStore.getState().tickets[composerKey] ?? [],
      turnConfiguration,
    }
    const created = await createDraft({ target, content: draftContent })
    const saved = await saveDraft({
      id: created.id,
      expectedRevision: created.revision,
      target,
      content: draftContent,
    })
    const submitted = await submit({
      draftId: saved.id,
      expectedRevision: saved.revision,
      commandId,
    })
    if (identity.kind === 'pending')
      useSessionCreationStore.getState().resolved(identity.sessionId, submitted.sessionId)
    return true
  } catch {
    if (identity.kind === 'pending') useSessionCreationStore.getState().failed(identity.sessionId)
    return false
  }
}

function useComposerSubmit({
  identity,
  harness,
  cockpit,
  workspace,
}: {
  identity: ComposerIdentity
  harness: HarnessControl
  cockpit: Cockpit
  workspace: WorkspaceCockpit
}) {
  const composerDraftCreate = useMutation(trpc.composerDraftCreate.mutationOptions())
  const composerDraftSave = useMutation(trpc.composerDraftSave.mutationOptions())
  const sessionSubmit = useMutation(trpc.sessionSubmit.mutationOptions())
  return (
    prompt: string,
    turnConfiguration: RouterInputs['composerDraftCreate']['content']['turnConfiguration'] | null,
    attachments: RouterInputs['composerDraftCreate']['content']['attachments'],
  ) =>
    submitFromComposer({
      createDraft: (input) => composerDraftCreate.mutateAsync(input),
      saveDraft: (input) => composerDraftSave.mutateAsync(input),
      submit: (input) => sessionSubmit.mutateAsync(input),
      identity,
      harness,
      cockpit,
      workspace,
      prompt,
      turnConfiguration,
      attachments,
    })
}

export function SessionComposerArea({
  permission,
  questionPending,
  session,
  harness,
  selectedSessionId,
  roster,
  cockpit,
  workspaceCockpit,
  workspaceActions,
}: SessionScreenDetailsProps) {
  const catalogQuery = useQuery(trpc.harnessCatalogRead.queryOptions({ harness: harness.harness }))
  const catalogRefresh = useMutation(trpc.harnessCatalogRefresh.mutationOptions())
  const location = useLocation()
  const catalog = catalogQuery.data?.info ?? null
  const catalogFailure = catalogFailureOf(catalogQuery.data, catalogQuery.isError)
  const pending = useSessionCreationStore((state) => state.pending)
  const identity = composerIdentityOf(
    selectedSessionId,
    cockpit.project?.id ?? null,
    pending?.stage === 'draft' ? pending.id : null,
  )
  const control = useTurnConfiguration({
    harness: harness.harness,
    choices: catalog?.availability === 'available' ? catalog : null,
    identity,
    rows: roster?.sessions ?? [],
  })
  const composerKey = composerIdentityKey(identity)
  const target = draftTarget({ identity, harness, cockpit, workspace: workspaceCockpit })
  const draftReady = useDurableComposerDraft({
    target,
    composerKey,
    turnConfiguration: control?.value ?? null,
  })
  const send = useComposerSubmit({ identity, harness, cockpit, workspace: workspaceCockpit })
  // The Roster already knows another process runs it live, so no Send is offered at all (ADR-0040).
  if (session?.locked === true) return <OpenElsewhere onRetry={null} />
  if (!draftReady) return null
  const refreshCatalog = () =>
    catalogRefresh.mutate(
      { harness: harness.harness },
      { onSettled: () => void catalogQuery.refetch() },
    )
  return (
    <>
      {permission.failure ? <Failure message={permission.failure} /> : null}
      <ComposerForm
        sessionId={composerKey}
        focusOnMount={location.state === COMPOSER_FOCUS_STATE}
        turnConfiguration={control}
        catalogFailure={catalogFailure}
        refreshCatalog={refreshCatalog}
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
        onSend={send}
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
  const { projectId } = useParams()
  return (
    <p className="mt-2">
      {label}{' '}
      <button
        className="text-foreground underline underline-offset-2"
        onClick={() => onNavigate(`/projects/${projectId}/sessions/${sessionId}`)}
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
