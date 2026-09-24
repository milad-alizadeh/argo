import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import type { Cockpit, ProjectActions } from '@/domains/projects/renderer'
import type { SessionAvailability } from '@/domains/sessions/contract/session-history'
import type { SessionListItem } from '@/domains/sessions/contract/session-list'
import type { SessionSubmitInput } from '@/domains/sessions/contract/session-start'
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
import { trpc } from '@/platform/renderer/trpc-client'
import { composerIdentityKey, composerIdentityOf } from '../composer/identity/composer-identity'
import { COMPOSER_COLUMN, ComposerForm } from '../composer/layout/composer-form'
import type { CatalogFailure } from '../composer/toolbar/run-setup-menu'
import { useTurnSetup } from '../composer/turn-setup/use-turn-setup'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import type { HarnessControl } from '../harness/harnesses'
import { useSessionCreationStore } from '../session-creation'

type SessionScreenDetailsProps = {
  permission: ReturnType<typeof import('../composer').useSessionPermission>
  questionPending: boolean
  indexedSession: SessionListItem | null
  availability: SessionAvailability | null
  retryAvailability: () => void
  harness: HarnessControl
  selectedSessionId: string | null
  cockpit: Cockpit
  projectActions: Pick<ProjectActions, 'selectWorkspace' | 'createManagedWorkspace'>
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
  cockpit: Cockpit,
  projectActions: SessionScreenDetailsProps['projectActions'],
) {
  if (identity.kind !== 'draft') return null
  return {
    workspaces: cockpit.workspaces,
    workspace: cockpit.workspace,
    onSelect: projectActions.selectWorkspace,
    onCreateManaged: () => projectActions.createManagedWorkspace('HEAD'),
  }
}

async function submitFromComposer({
  submit,
  identity,
  harness,
  cockpit,
  indexedSession,
  prompt,
  setup,
  attachments,
  onResolved,
}: {
  submit: (input: SessionSubmitInput) => Promise<{ sessionId: string }>
  identity: ReturnType<typeof composerIdentityOf>
  harness: HarnessControl
  cockpit: Cockpit
  indexedSession: SessionListItem | null
  prompt: string
  setup: SessionSubmitInput['setup'] | null
  attachments: SessionSubmitInput['attachments']
  onResolved: (sessionId: string) => void
}) {
  if (setup === null) return false
  const commandId =
    identity.kind === 'pending'
      ? useSessionCreationStore.getState().startSubmission(identity.sessionId, prompt)
      : crypto.randomUUID()
  if (commandId === null) return false
  try {
    const submitted = await submit({
      commandId,
      harness: harness.harness,
      projectId:
        identity.kind === 'session'
          ? (indexedSession?.projectId ?? null)
          : (cockpit.project?.id ?? null),
      cwd:
        identity.kind === 'session'
          ? (indexedSession?.workingDirectory ?? null)
          : (cockpit.workspace?.path ?? cockpit.project?.path ?? null),
      sessionId: identity.kind === 'session' ? identity.sessionId : null,
      pendingId: identity.kind === 'pending' ? identity.sessionId : null,
      prompt,
      attachments,
      setup,
    })
    if (identity.kind === 'pending') {
      useSessionCreationStore.getState().resolved(identity.sessionId, submitted.sessionId)
      onResolved(submitted.sessionId)
    }
    return true
  } catch {
    if (identity.kind === 'pending') useSessionCreationStore.getState().failed(identity.sessionId)
    return false
  }
}

function useSessionSubmit() {
  const mutation = useMutation(trpc.sessionSubmit.mutationOptions())
  const queryClient = useQueryClient()
  return async (input: SessionSubmitInput) => {
    const result = await mutation.mutateAsync(input)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.sessions.get.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.sessionFeed.queryKey() }),
    ])
    return result
  }
}

function useComposerControl({
  identity,
  harness,
  catalog,
}: {
  identity: ReturnType<typeof composerIdentityOf>
  harness: HarnessControl
  catalog: CatalogReadResult['info'] | null
}) {
  return useTurnSetup({
    harness: harness.harness,
    choices: catalog?.availability === 'available' ? catalog : null,
    identity,
    rows: [],
  })
}

function composerIdentity(
  selectedSessionId: string | null,
  cockpit: Cockpit,
  pending: ReturnType<typeof useSessionCreationStore.getState>['pending'],
) {
  return composerIdentityOf(
    selectedSessionId,
    cockpit.project?.id ?? null,
    pending?.stage === 'draft' ? pending.id : null,
  )
}

export function SessionComposerArea({
  permission,
  questionPending,
  indexedSession,
  availability,
  retryAvailability,
  harness,
  selectedSessionId,
  cockpit,
  projectActions,
}: SessionScreenDetailsProps) {
  const catalogQuery = useQuery(trpc.harnessCatalogRead.queryOptions({ harness: harness.harness }))
  const catalogRefresh = useMutation(trpc.harnessCatalogRefresh.mutationOptions())
  const submit = useSessionSubmit()
  const navigate = useNavigate()
  const location = useLocation()
  const catalogFailure = catalogFailureOf(catalogQuery.data, catalogQuery.isError)
  const pending = useSessionCreationStore((state) => state.pending)
  const identity = composerIdentity(selectedSessionId, cockpit, pending)
  const control = useComposerControl({
    identity,
    harness,
    catalog: catalogQuery.data?.info ?? null,
  })
  if (availability?.state === 'unavailable') return <OpenElsewhere onRetry={retryAvailability} />
  const refreshCatalog = () =>
    catalogRefresh.mutate(
      { harness: harness.harness },
      { onSettled: () => void catalogQuery.refetch() },
    )
  return (
    <>
      {permission.failure ? <Failure message={permission.failure} /> : null}
      <ComposerForm
        sessionId={composerIdentityKey(identity)}
        focusOnMount={location.state === COMPOSER_FOCUS_STATE}
        setup={control}
        catalogFailure={catalogFailure}
        refreshCatalog={refreshCatalog}
        workspace={workspaceControl(identity, cockpit, projectActions)}
        disabled={questionPending}
        harness={harness}
        permissionPrompt={
          <PermissionPrompt
            harness={harness.harness}
            permission={permission.permission}
            onDecide={permission.decide}
          />
        }
        plan={null}
        onSend={(prompt, setup, attachments) =>
          submitFromComposer({
            submit,
            identity,
            harness,
            cockpit,
            indexedSession,
            prompt,
            setup,
            attachments,
            onResolved: (sessionId) => navigate(`/sessions/${sessionId}`, { replace: true }),
          })
        }
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
