import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
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
  rejectSubmit: boolean
  savePending: boolean
  notify: () => void
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
    server.savePending = true
    notify()
    await new Promise<void>((resolve) => {
      server.releaseSave = resolve
    })
    server.savePending = false
  }
  const current = drafts.get(owner)
  if (current === undefined) throw new Error(`Missing draft for ${owner}.`)
  const saved: DraftValue = {
    ...current,
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
    ]),
    trpc: (async () => ({ result: { data: null } })) as unknown as typeof window.argo.trpc,
    releaseSave: notify,
    holdSessionASave: false,
    rejectSubmit: initialOutcome !== 'accept',
    savePending: false,
    notify,
  }
  server.trpc = createMockTrpc(server, notify)
  return server
}

function DurableDraftStory({
  initialOutcome = 'accept',
}: {
  initialOutcome?: 'accept' | 'reject' | 'fallback'
}) {
  const [serverVersion, setServerVersion] = useState(0)
  const [server] = useState(() =>
    createServer(() => setServerVersion((version) => version + 1), initialOutcome),
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
  const [sessionId, setSessionId] = useState('session-a')
  const [composerVersion, setComposerVersion] = useState(0)
  const target: DraftTarget = { type: 'session', sessionId }
  const draft = useDurableComposerDraft({ target, choices, opening: choices.opening })
  const storedDrafts = [...server.drafts.values()].map(({ target: storedTarget, ...value }) => ({
    target: storedTarget,
    prompt: value.prompt,
    revision: value.revision,
    turnConfiguration: value.turnConfiguration,
  }))
  void serverVersion
  return (
    <div className="mx-auto flex h-[560px] max-w-3xl flex-col gap-3 p-6">
      <div className="flex gap-2">
        <button onClick={() => setSessionId('session-a')} type="button">
          Session A
        </button>
        <button onClick={() => setSessionId('session-b')} type="button">
          Session B
        </button>
        <button onClick={() => setSessionId('session-a')} type="button">
          Reopen Session A
        </button>
        <button onClick={() => setComposerVersion((version) => version + 1)} type="button">
          Reload composer
        </button>
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
      </div>
      <output aria-label="Stored drafts" data-save-pending={server.savePending}>
        {JSON.stringify(storedDrafts)}
      </output>
      {draft?.sendFailed ? (
        <div role="alert">The Turn could not be sent. Your draft is still saved.</div>
      ) : null}
      {draft ? (
        <ComposerForm
          harness={{ harness: 'claude' }}
          initialEditing={draft.initialEditing}
          onEditingChange={draft.onEditingChange}
          onSend={async (prompt, turnConfiguration, attachments) =>
            (await draft.submit(prompt, turnConfiguration, attachments)) !== null
          }
          sessionId={`${sessionId}:${composerVersion}`}
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
