import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  queryClient,
  type RouterInputs,
  type RouterOutputs,
  trpc,
} from '@/platform/renderer/trpc-client'
import { claudeComposerModelCatalogFixture } from '../../../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
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
  savePending: boolean
  notify: () => void
  submittedTarget: DraftTarget | null
}
type MockInput = {
  target?: DraftTarget
  id?: string
  expectedRevision?: number
  content?: RouterInputs['composerDraftCreate']['content']
  draftId?: string
}

const choices = (() => {
  const value = claudeChoices(claudeComposerModelCatalogFixture())
  if (value === null) throw new Error('The Claude story catalog has no usable model.')
  return value
})()

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

function savedProjectDraft(): DraftValue {
  return {
    ...savedDraft('project-1', 'Plan this change.', 3),
    id: 'draft-project-1',
    target: {
      type: 'project',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      harness: 'claude',
    },
  }
}

function createReadResult(drafts: Map<string, DraftValue>, input: MockInput) {
  if (input.target === undefined) return null
  return drafts.get(ownerKey(input.target)) ?? null
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
  if (current === undefined) throw new Error(`Missing draft for ${owner}.`)
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

function submitDraftResult(request: {
  server: Server
  drafts: Map<string, DraftValue>
  input: MockInput
  notify: () => void
}) {
  const { server, drafts, input, notify } = request
  if (server.rejectSubmit) throw new Error('The Session rejected this Turn.')
  const submitted = [...drafts.entries()].find(([_, draft]) => draft.id === input.draftId)
  server.submittedTarget = submitted?.[1].target ?? null
  if (submitted !== undefined && submitted[1].revision === input.expectedRevision)
    drafts.delete(submitted[0])
  notify()
  return { sessionId: submitted?.[0] ?? 'session-a' }
}

function createMockTrpc(server: Server, notify: () => void): typeof window.argo.trpc {
  return (async (request) => {
    const input = request.input as MockInput
    if (request.path === 'composerDraftRead')
      return { result: { data: createReadResult(server.drafts, input) } }
    if (request.path === 'composerDraftCreate')
      return { result: { data: createCreateResult(server.drafts, input, notify) } }
    if (request.path === 'composerDraftSave')
      return {
        result: {
          data: await saveDraftResult({ server, drafts: server.drafts, input, notify }),
        },
      }
    if (request.path === 'sessionSubmit')
      return {
        result: {
          data: submitDraftResult({ server, drafts: server.drafts, input, notify }),
        },
      }
    return { result: { data: null } }
  }) as typeof window.argo.trpc
}

function createServer(
  notify: () => void,
  initialOutcome: 'accept' | 'reject' | 'fallback',
  project: boolean,
): Server {
  const firstDraft = savedDraft('session-a', 'Restored Session A draft.', 1)
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
      ...(project ? ([['project-1', savedProjectDraft()]] as const) : []),
    ]),
    trpc: (async () => ({ result: { data: null } })) as unknown as typeof window.argo.trpc,
    releaseSave: notify,
    holdSessionASave: false,
    failSessionASave: false,
    sessionASaveRejected: false,
    rejectSubmit: initialOutcome !== 'accept',
    savePending: false,
    notify,
    submittedTarget: null,
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

function DurableDraftStory({
  initialOutcome = 'accept',
  project = false,
}: {
  initialOutcome?: 'accept' | 'reject' | 'fallback'
  project?: boolean
}) {
  const [serverVersion, setServerVersion] = useState(0)
  const [screenVersion, setScreenVersion] = useState(0)
  const [server] = useState(() =>
    createServer(() => setServerVersion((version) => version + 1), initialOutcome, project),
  )
  const initialized = useRef(false)
  if (!initialized.current) {
    queryClient.removeQueries({ queryKey: trpc.composerDraftRead.pathKey() })
    window.argo.trpc = server.trpc
    Object.assign(window.argo, {
      statSessionAttachments: async ({ paths }: { paths: string[] }) => ({
        version: 1,
        type: 'session.attachments.statted',
        requestId: 'storybook-draft-attachments',
        files: paths.map((path) => ({ path, readable: true })),
      }),
    })
    initialized.current = true
  }
  void serverVersion
  return (
    <DurableDraftScreen
      key={screenVersion}
      server={server}
      project={project}
      onReloadScreen={() => setScreenVersion((version) => version + 1)}
    />
  )
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
  const [harness, setHarness] = useState<'claude' | 'codex'>('claude')
  const [composerVersion, setComposerVersion] = useState(0)
  const [restoredProjectId, setRestoredProjectId] = useState<string | null>(null)
  const target: DraftTarget = project
    ? { type: 'project', projectId: 'project-1', workspaceId, harness }
    : { type: 'session', sessionId }
  const targetRestored = !project || restoredProjectId === 'project-1'
  const draft = useDurableComposerDraft({
    target,
    choices,
    opening: choices.opening,
    targetRestored,
  })
  const loadedTarget = draft?.loadedTarget
  useEffect(() => {
    if (!project || restoredProjectId !== null || loadedTarget?.type !== 'project') return
    setWorkspaceId(loadedTarget.workspaceId)
    setHarness(loadedTarget.harness)
    setRestoredProjectId(loadedTarget.projectId)
  }, [project, restoredProjectId, loadedTarget])
  const storedDrafts = [...server.drafts.values()].map(({ target: storedTarget, ...value }) => ({
    target: storedTarget,
    prompt: value.prompt,
    revision: value.revision,
    turnConfiguration: value.turnConfiguration,
  }))
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
      </div>
      <output aria-label="Stored drafts" data-save-pending={server.savePending}>
        {JSON.stringify(storedDrafts)}
      </output>
      <output aria-label="Submitted target">{JSON.stringify(server.submittedTarget)}</output>
      <output aria-label="Current save failure">{String(draft?.saveFailed ?? false)}</output>
      <output aria-label="Session A save rejected">{String(server.sessionASaveRejected)}</output>
      <output aria-label="Current target">{JSON.stringify(target)}</output>
      {draft?.sendFailed ? (
        <div role="alert">The Turn could not be sent. Your draft is still saved.</div>
      ) : null}
      {draft && targetRestored ? (
        <ComposerForm
          harness={{ harness }}
          initialEditing={draft.initialEditing}
          onEditingChange={draft.onEditingChange}
          onSend={async (prompt, turnConfiguration, attachments) =>
            (await draft.submit(prompt, turnConfiguration, attachments)) !== null
          }
          sessionId={`${project ? 'project-1' : sessionId}:${composerVersion}`}
          turnConfigurationChoices={choices as TurnConfigurationChoices}
        />
      ) : null}
    </div>
  )
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
      await canvas.findByText('The Turn could not be sent. Your draft is still saved.'),
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

async function serverRequestedSave(canvasElement: HTMLElement) {
  await waitFor(() =>
    expect(within(canvasElement).getByLabelText('Stored drafts')).toHaveAttribute(
      'data-save-pending',
      'true',
    ),
  )
}
