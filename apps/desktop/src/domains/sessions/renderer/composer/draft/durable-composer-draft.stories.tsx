import type { Meta, StoryObj } from '@storybook/react-vite'
import { useCallback, useEffect, useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { Harness } from '@/harnesses/harness'
import { claudeComposerModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { claudeChoices, codexHarnessInfoFixture } from '@/mocks/sessions/harness-catalog.fixture'
import {
  queryClient,
  type RouterInputs,
  type RouterOutputs,
  trpc,
} from '@/platform/renderer/trpc-client'
import { useComposerFailureToasts } from '../../screens/use-composer-failure-toasts'
import { ComposerForm } from '../layout/composer-form'
import type { TurnConfigurationChoices } from '../turn-configuration/turn-configuration'
import { useDurableComposerDraft } from './use-durable-composer-draft'

type DraftValue = RouterOutputs['composerDraftCreate']
type DraftTarget = RouterInputs['composerDraftCreate']['target']
type Server = {
  drafts: Map<string, DraftValue>
  trpc: typeof window.argo.trpc
  releaseSave: () => void
  holdSessionASave: boolean
  failSessionASave: boolean
  sessionASaveRejected: boolean
  rejectSubmit: boolean
  uncertainSubmit: boolean
  holdSubmit: boolean
  submitPending: boolean
  releaseSubmit: () => void
  submissions: MockInput[]
  savePending: boolean
  draftReadFailures: number
  notify: () => void
  submittedTarget: DraftTarget | null
  submittedTurnConfiguration: DraftValue['turnConfiguration'] | null
}
type MockInput = {
  target?: DraftTarget
  id?: string
  expectedRevision?: number
  content?: RouterInputs['composerDraftCreate']['content']
  draftId?: string
  commandId?: string
}

const choices = (() => {
  const value = claudeChoices(claudeComposerModelCatalogFixture())
  if (value === null) throw new Error('The Claude story catalog has no usable model.')
  return value
})()
const codexChoices = codexHarnessInfoFixture()

function ownerKey(target: DraftTarget) {
  return target.type === 'session' ? target.sessionId : target.projectId
}

function savedDraft(sessionId: string, prompt: string, now: number): DraftValue {
  return {
    id: `draft-${sessionId}`,
    target: { type: 'session', sessionId },
    prompt,
    attachments: [{ path: '/repo/notes.md', kind: 'file' }],
    ticketContext: [
      {
        id: `ticket-${sessionId}`,
        provider: 'github',
        key: 'argo-2759',
        title: 'Store Session drafts',
        status: 'In progress',
        terminal: false,
        blocked: null,
      },
    ],
    turnConfiguration: choices.opening,
    revision: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function savedProjectDraft(harness: Harness): DraftValue {
  return {
    ...savedDraft('project-1', 'Plan this change.', 3),
    id: 'draft-project-1',
    turnConfiguration: harness === 'codex' ? codexChoices.opening : choices.opening,
    target: {
      type: 'project',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      harness,
    },
  }
}

function createReadResult(drafts: Map<string, DraftValue>, target: DraftTarget) {
  return drafts.get(ownerKey(target)) ?? null
}

function createCreateResult(drafts: Map<string, DraftValue>, input: MockInput, notify: () => void) {
  if (input.target === undefined || input.content === undefined) return null
  const owner = ownerKey(input.target)
  const existing = drafts.get(owner)
  if (existing !== undefined) return existing
  const now = Date.now()
  const created: DraftValue = {
    id: `draft-${owner}`,
    target: input.target,
    ...input.content,
    revision: 0,
    createdAt: now,
    updatedAt: now,
  }
  drafts.set(owner, created)
  notify()
  return created
}

async function saveDraftResult(request: {
  server: Server
  drafts: Map<string, DraftValue>
  input: MockInput
  notify: () => void
}) {
  const { server, drafts, input, notify } = request
  if (input.target === undefined || input.content === undefined) return null
  const owner = ownerKey(input.target)
  if (owner === 'session-a' && server.holdSessionASave) {
    server.holdSessionASave = false
    server.savePending = true
    notify()
    await new Promise<void>((resolve) => {
      server.releaseSave = resolve
    })
    server.savePending = false
    if (server.failSessionASave) {
      server.sessionASaveRejected = true
      notify()
      throw new Error('Session A save failed.')
    }
  }
  const current = drafts.get(owner)
  if (current === undefined) throw new Error('missing-draft')
  if (current.revision !== input.expectedRevision) throw new Error('stale-draft')
  const saved: DraftValue = {
    ...current,
    target: input.target,
    ...input.content,
    revision: current.revision + 1,
    updatedAt: Date.now(),
  }
  drafts.set(owner, saved)
  notify()
  return saved
}

async function submitDraftResult(request: {
  server: Server
  drafts: Map<string, DraftValue>
  input: MockInput
  notify: () => void
}) {
  const { server, drafts, input, notify } = request
  server.submissions.push(input)
  if (server.holdSubmit) {
    server.submitPending = true
    notify()
    await new Promise<void>((resolve) => {
      server.releaseSubmit = resolve
    })
    server.submitPending = false
    notify()
  }
  if (server.uncertainSubmit) throw new Error('The Send response was lost.')
  const submitted = [...drafts.entries()].find(([_, draft]) => draft.id === input.draftId)
  server.submittedTarget = submitted?.[1].target ?? null
  server.submittedTurnConfiguration = submitted?.[1].turnConfiguration ?? null
  if (submitted !== undefined && submitted[1].revision === input.expectedRevision)
    drafts.delete(submitted[0])
  notify()
  return { sessionId: submitted?.[0] ?? 'session-a' }
}

async function mockSave(server: Server, input: MockInput, notify: () => void) {
  try {
    return {
      result: { data: await saveDraftResult({ server, drafts: server.drafts, input, notify }) },
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-draft')
      return {
        error: {
          message: 'missing-draft',
          code: -32004,
          data: { code: 'NOT_FOUND', httpStatus: 404, path: 'composerDraftSave' },
        },
      }
    throw error
  }
}

async function mockSubmit(server: Server, input: MockInput, notify: () => void) {
  if (server.rejectSubmit && !server.uncertainSubmit) {
    server.submissions.push(input)
    notify()
    return {
      error: {
        message: 'The Session rejected this Turn.',
        code: -32012,
        data: { code: 'PRECONDITION_FAILED', httpStatus: 412, path: 'sessionSubmit' },
      },
    }
  }
  return {
    result: { data: await submitDraftResult({ server, drafts: server.drafts, input, notify }) },
  }
}

function createMockTrpc(server: Server, notify: () => void): typeof window.argo.trpc {
  return (async (request) => {
    const input = request.input as MockInput
    if (request.path === 'composerDraftRead') {
      if (server.draftReadFailures > 0) {
        server.draftReadFailures -= 1
        notify()
        throw new Error('The saved draft could not be read.')
      }
      return { result: { data: createReadResult(server.drafts, request.input as DraftTarget) } }
    }
    if (request.path === 'composerDraftCreate')
      return { result: { data: createCreateResult(server.drafts, input, notify) } }
    if (request.path === 'composerDraftSave') return mockSave(server, input, notify)
    if (request.path === 'sessionSubmit') return mockSubmit(server, input, notify)
    return { result: { data: null } }
  }) as typeof window.argo.trpc
}

function createServer(input: {
  notify: () => void
  initialOutcome: 'accept' | 'reject' | 'uncertain' | 'fallback'
  initialPrompt: string
  project: boolean
  projectDraftExists: boolean
  savedProjectHarness: Harness
  draftReadFailures: number
}): Server {
  const {
    notify,
    initialOutcome,
    initialPrompt,
    project,
    projectDraftExists,
    savedProjectHarness,
    draftReadFailures,
  } = input
  const firstDraft = savedDraft('session-a', initialPrompt, 1)
  if (initialOutcome === 'fallback')
    firstDraft.turnConfiguration = {
      model: 'model-no-longer-available',
      effort: 'unknown-effort',
      mode: 'unknown-mode',
    }
  const server: Server = {
    drafts: new Map([
      ['session-a', firstDraft],
      ['session-b', savedDraft('session-b', 'Restored Session B draft.', 2)],
      ...(project && projectDraftExists
        ? ([['project-1', savedProjectDraft(savedProjectHarness)]] as const)
        : []),
    ]),
    trpc: (async () => ({ result: { data: null } })) as unknown as typeof window.argo.trpc,
    releaseSave: notify,
    holdSessionASave: false,
    failSessionASave: false,
    sessionASaveRejected: false,
    rejectSubmit: initialOutcome === 'reject' || initialOutcome === 'fallback',
    uncertainSubmit: initialOutcome === 'uncertain',
    holdSubmit: false,
    submitPending: false,
    releaseSubmit: notify,
    submissions: [],
    savePending: false,
    draftReadFailures,
    notify,
    submittedTarget: null,
    submittedTurnConfiguration: null,
  }
  server.trpc = createMockTrpc(server, notify)
  return server
}

function DraftOwnerControls({
  project,
  onSession,
  onReload,
  onScreenReload,
  onWorkspace,
  onHarness,
}: {
  project: boolean
  onSession: (sessionId: string) => void
  onReload: () => void
  onScreenReload: () => void
  onWorkspace: () => void
  onHarness: () => void
}) {
  return (
    <>
      <button onClick={() => onSession('session-a')} type="button">
        Session A
      </button>
      <button onClick={() => onSession('session-b')} type="button">
        Session B
      </button>
      <button onClick={() => onSession('session-a')} type="button">
        Reopen Session A
      </button>
      <button onClick={onReload} type="button">
        Reload composer
      </button>
      <button onClick={onScreenReload} type="button">
        Reload screen
      </button>
      {project ? (
        <>
          <button onClick={onWorkspace} type="button">
            Workspace 2
          </button>
          <button onClick={onHarness} type="button">
            Harness Codex
          </button>
        </>
      ) : null}
    </>
  )
}

function DraftTimingControls({ server }: { server: Server }) {
  return (
    <>
      <button
        onClick={() => {
          server.holdSessionASave = true
        }}
        type="button"
      >
        Hold Session A saves
      </button>
      <button onClick={() => server.releaseSave()} type="button">
        Release Session A save
      </button>
      <button onClick={() => (server.holdSubmit = true)} type="button">
        Hold Sends
      </button>
      <button onClick={() => server.releaseSubmit()} type="button">
        Release Send
      </button>
      <button
        onClick={() => {
          server.failSessionASave = true
          server.releaseSave()
        }}
        type="button"
      >
        Fail Session A save
      </button>
      <button
        onClick={() => {
          queryClient.setQueryData(
            trpc.composerDraftRead.queryKey({ type: 'session', sessionId: 'session-a' }),
            savedDraft('session-a', 'Late Session A read.', Date.now()),
          )
        }}
        type="button"
      >
        Apply late Session A read
      </button>
    </>
  )
}

function DraftReadControls({ server, target }: { server: Server; target: DraftTarget }) {
  return (
    <>
      <button
        onClick={() => {
          server.draftReadFailures = 1
          server.notify()
        }}
        type="button"
      >
        Fail next draft read
      </button>
      <button
        onClick={() =>
          void queryClient.invalidateQueries({
            queryKey: trpc.composerDraftRead.queryKey(target),
          })
        }
        type="button"
      >
        Refresh draft
      </button>
    </>
  )
}

function useDraftStoryRetryFocus(draft: ReturnType<typeof useDurableComposerDraft>) {
  const [focusComposerAfterRetry, setFocusComposerAfterRetry] = useState(false)
  const retryDraftLoad = () => {
    void draft?.retryLoad().then(({ isSuccess }) => {
      if (isSuccess) setFocusComposerAfterRetry(true)
    })
  }
  const clearRecoveryFocus = useCallback(() => setFocusComposerAfterRetry(false), [])
  return { focusComposerAfterRetry, retryDraftLoad, clearRecoveryFocus }
}

function DurableDraftStory({
  initialOutcome = 'accept',
  initialPrompt = 'Restored Session A draft.',
  project = false,
  projectDraftExists = true,
  savedProjectHarness = 'claude',
  draftReadFailures = 0,
}: {
  initialOutcome?: 'accept' | 'reject' | 'uncertain' | 'fallback'
  initialPrompt?: string
  project?: boolean
  projectDraftExists?: boolean
  savedProjectHarness?: Harness
  draftReadFailures?: number
}) {
  const [serverVersion, setServerVersion] = useState(0)
  const [screenVersion, setScreenVersion] = useState(0)
  const [server] = useState(() =>
    createServer({
      notify: () => setServerVersion((version) => version + 1),
      initialOutcome,
      initialPrompt,
      project,
      projectDraftExists,
      savedProjectHarness,
      draftReadFailures,
    }),
  )
  const initialized = useRef(false)
  if (!initialized.current) {
    queryClient.removeQueries({ queryKey: trpc.composerDraftRead.pathKey() })
    const serverTrpc = server.trpc
    window.argo.trpc = (async (request) => {
      if (request.path !== 'sessionAttachmentStat') return serverTrpc(request)
      const paths = (request.input as { paths: string[] }).paths
      return {
        id: request.id,
        result: { data: { files: paths.map((path) => ({ path, readable: true })) } },
      }
    }) as typeof window.argo.trpc
    initialized.current = true
  }
  void serverVersion
  return (
    <DurableDraftScreen
      key={screenVersion}
      server={server}
      project={project}
      onReloadScreen={() => {
        queryClient.removeQueries({ queryKey: trpc.composerDraftRead.pathKey() })
        setScreenVersion((version) => version + 1)
      }}
    />
  )
}

function useRestoreProjectDraftStory(input: {
  project: boolean
  restoredProjectId: string | null
  loadedTarget: DraftTarget | null | undefined
  harness: Harness
  setWorkspaceId: (workspaceId: string) => void
  setHarness: (harness: Harness) => void
  setRestoredProjectId: (projectId: string) => void
}) {
  const {
    project,
    restoredProjectId,
    loadedTarget,
    harness,
    setWorkspaceId,
    setHarness,
    setRestoredProjectId,
  } = input
  useEffect(() => {
    if (!project || restoredProjectId !== null || loadedTarget === undefined) return
    if (loadedTarget === null) {
      setRestoredProjectId('project-1')
      return
    }
    if (loadedTarget.type !== 'project') return
    setWorkspaceId(loadedTarget.workspaceId ?? 'new')
    if (harness !== loadedTarget.harness) {
      setHarness(loadedTarget.harness)
      return
    }
    setRestoredProjectId(loadedTarget.projectId)
  }, [
    project,
    restoredProjectId,
    loadedTarget,
    harness,
    setWorkspaceId,
    setHarness,
    setRestoredProjectId,
  ])
}

function DurableDraftScreen({
  server,
  project,
  onReloadScreen,
}: {
  server: Server
  project: boolean
  onReloadScreen: () => void
}) {
  const [sessionId, setSessionId] = useState('session-a')
  const [workspaceId, setWorkspaceId] = useState('workspace-1')
  const [harness, setHarness] = useState<Harness>('claude')
  const [composerVersion, setComposerVersion] = useState(0)
  const [restoredProjectId, setRestoredProjectId] = useState<string | null>(null)
  const target: DraftTarget = project
    ? { type: 'project', projectId: 'project-1', workspaceId, harness }
    : { type: 'session', sessionId }
  const targetRestored = !project || restoredProjectId === 'project-1'
  const currentChoices = harness === 'codex' ? codexChoices : choices
  const draft = useDurableComposerDraft({
    target,
    choices: currentChoices,
    opening: currentChoices.opening,
    targetRestored,
  })
  const loadedTarget = draft?.loadedTarget
  useRestoreProjectDraftStory({
    project,
    restoredProjectId,
    loadedTarget,
    harness,
    setWorkspaceId,
    setHarness,
    setRestoredProjectId,
  })
  const { focusComposerAfterRetry, retryDraftLoad, clearRecoveryFocus } =
    useDraftStoryRetryFocus(draft)
  return (
    <div className="mx-auto flex h-[560px] max-w-3xl flex-col gap-3 p-6">
      <div className="flex gap-2">
        <DraftOwnerControls
          project={project}
          onSession={setSessionId}
          onReload={() => setComposerVersion((version) => version + 1)}
          onScreenReload={onReloadScreen}
          onWorkspace={() => setWorkspaceId('workspace-2')}
          onHarness={() => setHarness('codex')}
        />
        <DraftTimingControls server={server} />
        <DraftReadControls server={server} target={target} />
      </div>
      <DraftStoryDetails server={server} draft={draft} target={target} />
      {draft && (targetRestored || draft.loadFailed) ? (
        <DurableDraftComposer
          draft={draft}
          harness={harness}
          choices={currentChoices}
          sessionId={`${project ? 'project-1' : sessionId}:${composerVersion}:${draft.hasDraft ? 'ready' : 'load-failed'}`}
          focusOnRetry={focusComposerAfterRetry}
          onFocusAfterMount={clearRecoveryFocus}
          onRetry={retryDraftLoad}
        />
      ) : null}
    </div>
  )
}

function DraftStoryDetails({
  server,
  draft,
  target,
}: {
  server: Server
  draft: ReturnType<typeof useDurableComposerDraft>
  target: DraftTarget
}) {
  return (
    <>
      <output
        aria-label="Stored drafts"
        data-save-pending={server.savePending}
        data-submit-pending={server.submitPending}
        data-read-failures={server.draftReadFailures}
      >
        {JSON.stringify(storedDraftSummaries(server.drafts))}
      </output>
      <output aria-label="Submitted target">{JSON.stringify(server.submittedTarget)}</output>
      <output aria-label="Submitted Turn configuration">
        {JSON.stringify(server.submittedTurnConfiguration)}
      </output>
      <output aria-label="Send commands">{JSON.stringify(server.submissions)}</output>
      <output aria-label="Current save failure">{String(draft?.saveFailed ?? false)}</output>
      <output aria-label="Session A save rejected">{String(server.sessionASaveRejected)}</output>
      <output aria-label="Current target">{JSON.stringify(target)}</output>
    </>
  )
}

function DurableDraftComposer({
  draft,
  harness,
  choices,
  sessionId,
  focusOnRetry,
  onFocusAfterMount,
  onRetry,
}: {
  draft: NonNullable<ReturnType<typeof useDurableComposerDraft>>
  harness: Harness
  choices: TurnConfigurationChoices
  sessionId: string
  focusOnRetry: boolean
  onFocusAfterMount: () => void
  onRetry: () => void
}) {
  const report = useComposerFailureToasts(
    draft.loadFailed
      ? [{ scope: sessionId, title: 'Argo could not load this draft.', retry: onRetry }]
      : [],
    [sessionId],
  )
  return (
    <ComposerForm
      harness={{ harness }}
      initialEditing={draft.initialEditing}
      onEditingChange={draft.onEditingChange}
      onSend={async (prompt, turnConfiguration, attachments) => {
        const { outcome } = await draft.submit({ prompt, turnConfiguration, attachments })
        if (outcome !== 'accepted')
          report({
            scope: sessionId,
            title:
              outcome === 'rejected'
                ? 'The Turn could not be sent. Your draft is still saved.'
                : 'Argo could not confirm whether the Turn was sent. Your draft is still saved.',
          })
        return outcome
      }}
      sessionId={sessionId}
      disabled={draft.loadFailed && !draft.hasDraft}
      focusOnMount={focusOnRetry}
      onFocusAfterMount={onFocusAfterMount}
      turnConfigurationChoices={choices}
    />
  )
}

function storedDraftSummaries(drafts: Map<string, DraftValue>) {
  return [...drafts.values()].map(({ target, prompt, revision, turnConfiguration }) => ({
    target,
    prompt,
    revision,
    turnConfiguration,
  }))
}

const meta = {
  title: 'Sessions/Composer/Durable Draft',
  component: DurableDraftStory,
} satisfies Meta<typeof DurableDraftStory>

export default meta
type Story = StoryObj<typeof meta>

export const RestoresAndRetainsRejectedDrafts: Story = {
  args: { initialOutcome: 'reject' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    await expect(canvas.getByRole('button', { name: 'Remove notes' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Reload composer' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session A draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        'The Turn could not be sent. Your draft is still saved.',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent('Restored Session A draft.'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Reload composer' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session A draft.',
    )
  },
}

export const RestoredReferenceSurvivesSwitchAndRejectedKeyboardSend: Story = {
  args: {
    initialOutcome: 'reject',
    initialPrompt: 'Use [$implement](/skills/implement/SKILL.md) for this.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await expect(canvas.getByText('Implement')).toBeVisible()
    await expect(editor).toHaveTextContent('for this.')

    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session B draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Reopen Session A' }))
    const restored = await canvas.findByLabelText('Message')
    await expect(canvas.getByText('Implement')).toBeVisible()
    await userEvent.click(restored)
    await userEvent.keyboard('{Enter}')
    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        'The Turn could not be sent. Your draft is still saved.',
      ),
    ).toBeInTheDocument()
    await expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent(
      'Use [$implement](/skills/implement/SKILL.md) for this.',
    )
    await expect(canvas.getByText('Implement')).toBeVisible()
  },
}

export const DraftReadFailureCanRetry: Story = {
  args: { draftReadFailures: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await expect(await page.findByText('Argo could not load this draft.')).toBeVisible()
    const retry = page.getByRole('button', { name: 'Retry' })
    retry.focus()
    await userEvent.keyboard('{Enter}')
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    await waitFor(() => expect(editor).toHaveFocus())
    await waitFor(() => expect(page.queryByText('Argo could not load this draft.')).toBeNull())
  },
}

export const KeepsLoadedDraftAfterRefreshFails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    await userEvent.click(canvas.getByRole('button', { name: 'Fail next draft read' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh draft' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute('data-read-failures', '0'),
    )
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    const page = within(canvasElement.ownerDocument.body)
    await expect(await page.findByText('Argo could not load this draft.')).toBeVisible()
    const retry = page.getByRole('button', { name: 'Retry' })
    retry.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(page.queryByText('Argo could not load this draft.')).toBeNull())
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    await waitFor(() => expect(editor).toHaveFocus())
  },
}

export const KeepsUnavailableConfigurationUntilSubmit: Story = {
  args: { initialOutcome: 'fallback' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    const store = canvas.getByLabelText('Stored drafts')
    await expect(store).toHaveTextContent('model-no-longer-available')
    await expect(store).toHaveTextContent('"revision":0')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(store).toHaveTextContent(choices.opening.model))
    await expect(store).toHaveTextContent('"revision":1')
    await expect(store).not.toHaveTextContent('model-no-longer-available')
    await expect(editor).toHaveTextContent('Restored Session A draft.')
  },
}

export const AcceptedSendClearsTheCachedDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(editor).not.toHaveTextContent('Restored Session A draft.'))
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session B draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Reopen Session A' }))
    await expect(await canvas.findByLabelText('Message')).not.toHaveTextContent(
      'Restored Session A draft.',
    )
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).not.toHaveTextContent(
        'Restored Session A draft.',
      ),
    )
  },
}

export const UncertainSendKeepsItsDraftWithoutResending: Story = {
  args: { initialOutcome: 'uncertain' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        'Argo could not confirm whether the Turn was sent. Your draft is still saved.',
      ),
    ).toBeInTheDocument()
    await expect(editor).toHaveTextContent('Restored Session A draft.')
    await expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent(
      'Restored Session A draft.',
    )
    await waitFor(() => {
      const commands = JSON.parse(
        canvas.getByLabelText('Send commands').textContent ?? '[]',
      ) as MockInput[]
      expect(commands).toHaveLength(1)
      expect(commands[0]?.expectedRevision).toBe(0)
      expect(commands[0]?.commandId).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
      )
    })
  },
}

export const SwitchingSessionsDuringSendKeepsTheOtherDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Sends' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute('data-submit-pending', 'true'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    const otherEditor = await canvas.findByLabelText('Message')
    await expect(otherEditor).toHaveTextContent('Restored Session B draft.')
    await userEvent.click(canvas.getByRole('button', { name: 'Release Send' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute(
        'data-submit-pending',
        'false',
      ),
    )
    await expect(otherEditor).toHaveTextContent('Restored Session B draft.')
    await expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent(
      'Restored Session B draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Reopen Session A' }))
    await expect(await canvas.findByLabelText('Message')).not.toHaveTextContent(
      'Restored Session A draft.',
    )
  },
}

export const AcceptedSendKeepsAlreadySavedNewerEdit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Sends' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute('data-submit-pending', 'true'),
    )
    await userEvent.clear(editor)
    await userEvent.type(editor, 'A newer Session A draft.')
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent('A newer Session A draft.'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Release Send' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute(
        'data-submit-pending',
        'false',
      ),
    )
    await expect(editor).toHaveTextContent('A newer Session A draft.')
    await expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent(
      'A newer Session A draft.',
    )
  },
}

export const AcceptedSendRecreatesANewerEditSavedAfterAcceptance: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Sends' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Session A saves' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute('data-submit-pending', 'true'),
    )
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Saved after acceptance.')
    await serverRequestedSave(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Release Send' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveAttribute(
        'data-submit-pending',
        'false',
      ),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Release Session A save' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent('Saved after acceptance.'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session B draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Reopen Session A' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Saved after acceptance.',
    )
  },
}

// A render during the Send's save must not re-save the sent text; release within 250 ms (#3072).
export const AcceptedSendStaysClearedAfterARenderDuringItsSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Session A saves' }))
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Sent while saving.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await serverRequestedSave(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Release Session A save' }))
    await waitFor(() => expect(editor).not.toHaveTextContent('Sent while saving.'))
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    const otherEditor = await canvas.findByLabelText('Message')
    await expect(otherEditor).toHaveTextContent('Restored Session B draft.')
    await userEvent.type(otherEditor, ' Saved later.')
    // Session B's autosave is armed after any Session A one, so it lands after it too.
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent('Saved later.'),
    )
    await expect(canvas.getByLabelText('Stored drafts')).not.toHaveTextContent('Sent while saving.')
  },
}

export const TargetSwitchKeepsAnInFlightSaveWithItsOwner: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Session A saves' }))
    const editor = canvas.getByLabelText('Message')
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Updated Session A draft.')
    await serverRequestedSave(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    const otherEditor = await canvas.findByLabelText('Message')
    await expect(otherEditor).toHaveTextContent('Restored Session B draft.')
    await userEvent.clear(otherEditor)
    await userEvent.type(otherEditor, 'Updated Session B draft.')
    await userEvent.click(canvas.getByRole('button', { name: 'Release Session A save' }))
    await waitFor(() => {
      const store = canvas.getByLabelText('Stored drafts').textContent ?? ''
      expect(store).toContain('Updated Session A draft.')
      expect(store).toContain('Updated Session B draft.')
    })
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Updated Session B draft.')
  },
}

export const SavesOneOwnerInRevisionOrder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Session A saves' }))
    await userEvent.clear(editor)
    await userEvent.type(editor, 'First revision.')
    await serverRequestedSave(canvasElement)
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Second revision.')
    await userEvent.click(canvas.getByRole('button', { name: 'Release Session A save' }))
    await waitFor(() => {
      const store = canvas.getByLabelText('Stored drafts')
      expect(store).toHaveTextContent('Second revision.')
      expect(store).toHaveTextContent('"revision":2')
    })
  },
}

export const LateSessionReadKeepsTheCurrentDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session A draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Restored Session B draft.')
    await userEvent.click(canvas.getByRole('button', { name: 'Apply late Session A read' }))
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Restored Session B draft.')
  },
}

export const LateSessionSaveFailureKeepsTheCurrentOwner: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await userEvent.click(canvas.getByRole('button', { name: 'Hold Session A saves' }))
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Session A pending save.')
    await serverRequestedSave(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Session B' }))
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent(
      'Restored Session B draft.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Fail Session A save' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Session A save rejected')).toHaveTextContent('true'),
    )
    await expect(canvas.getByLabelText('Current save failure')).toHaveTextContent('false')
    await expect(canvas.getByLabelText('Message')).toHaveTextContent('Restored Session B draft.')
  },
}

export const ProjectTargetChangesWithoutTextPersistForSend: Story = {
  args: { project: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const editor = await canvas.findByLabelText('Message')
    await expect(editor).toHaveTextContent('Plan this change.')
    await userEvent.click(canvas.getByRole('button', { name: 'Workspace 2' }))
    const store = canvas.getByLabelText('Stored drafts')
    await waitFor(() => expect(store).toHaveTextContent('"workspaceId":"workspace-2"'))
    await expect(store).toHaveTextContent('"harness":"claude"')
    await userEvent.click(canvas.getByRole('button', { name: 'Harness Codex' }))
    await waitFor(() => expect(store).toHaveTextContent('"revision":2'))
    await expect(store).toHaveTextContent('"harness":"codex"')
    await userEvent.click(canvas.getByRole('button', { name: 'Reload screen' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Current target')).toHaveTextContent(
        '"workspaceId":"workspace-2"',
      ),
    )
    await expect(canvas.getByLabelText('Current target')).toHaveTextContent('"harness":"codex"')
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent('Plan this change.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Submitted target')).toHaveTextContent(
        '"workspaceId":"workspace-2"',
      ),
    )
    await expect(canvas.getByLabelText('Submitted target')).toHaveTextContent('"harness":"codex"')
  },
}

export const HarnessSwitchSendsAConfigurationTheNewHarnessOffers: Story = {
  args: { project: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent('Plan this change.')
    await userEvent.click(canvas.getByRole('button', { name: 'Harness Codex' }))
    await waitFor(() =>
      expect(canvas.getByLabelText('Current target')).toHaveTextContent('"harness":"codex"'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    const submitted = canvas.getByLabelText('Submitted Turn configuration')
    await waitFor(() => expect(submitted).not.toHaveTextContent('null'))
    const { mode } = JSON.parse(submitted.textContent ?? 'null') as { mode: string }
    await expect(codexChoices.modes.map(({ value }) => value)).toContain(mode)
  },
}

export const RestoresSavedCodexConfigurationBeforeSend: Story = {
  args: { project: true, savedProjectHarness: 'codex', initialOutcome: 'reject' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const store = canvas.getByLabelText('Stored drafts')
    await expect(store).toHaveTextContent('"model":"gpt-live"')
    await expect(await canvas.findByLabelText('Message')).toHaveTextContent('Plan this change.')
    await waitFor(() =>
      expect(canvas.getByLabelText('Current target')).toHaveTextContent('"harness":"codex"'),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send message' }))
    await within(canvasElement.ownerDocument.body).findByText(
      'The Turn could not be sent. Your draft is still saved.',
    )
    await expect(store).toHaveTextContent('"model":"gpt-live"')
    await expect(store).toHaveTextContent('"revision":0')
  },
}

export const CreatesProjectDraftAfterEmptyRead: Story = {
  args: { project: true, projectDraftExists: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByLabelText('Message')
    await waitFor(() =>
      expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent('"projectId":"project-1"'),
    )
    await expect(canvas.getByLabelText('Stored drafts')).toHaveTextContent('"revision":0')
  },
}

async function serverRequestedSave(canvasElement: HTMLElement) {
  await waitFor(() =>
    expect(within(canvasElement).getByLabelText('Stored drafts')).toHaveAttribute(
      'data-save-pending',
      'true',
    ),
  )
}
