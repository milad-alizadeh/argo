import {
  sessionFeedSubscribe,
  sessionListSubscribe,
} from '@/domains/sessions/renderer/session-fixtures'
import { sessionRosterPathKey } from '@/domains/sessions/renderer/session-list/session-roster'
import type { Session, SessionFeedSnapshot } from '@/domains/sessions/renderer/types'
import { queryClient, trpc } from '@/platform/renderer/trpc-client'
import { claudeHarnessInfoFixture, codexHarnessInfoFixture } from './harness-catalog.fixture'

// A story host that answers the production Session screen's tRPC reads, so a story can select
// and switch Sessions the way the cockpit does.

type StorybookTrpcRequest = Parameters<typeof window.argo.trpc>[0]
type StorybookTrpcResponse = Awaited<ReturnType<typeof window.argo.trpc>>

function success(data: unknown): StorybookTrpcResponse {
  return { result: { data } } as StorybookTrpcResponse
}

function projectReply(request: StorybookTrpcRequest): StorybookTrpcResponse | null {
  const project = { id: 'project-1', name: 'Argo', path: '/storybook/argo' }
  switch (request.path) {
    case 'projectList':
      return success([project])
    case 'projectOpen':
      return success(project)
    case 'workspaceList':
      return success({
        type: 'workspace.listed',
        requestId: '00000000-0000-4000-8000-000000000001',
        workspaces: [],
      })
    default:
      return null
  }
}

// Drafts the host has saved, so a Session opened again reads back what it was left with.
const drafts = new Map<string, object>()

export function savedSelectionDraft(target: object) {
  return drafts.get(JSON.stringify(target))
}

// Draft reads the story holds back until it releases them, by Session id.
const heldDraftReads = new Map<string, () => void>()

export function releaseDraftRead(sessionId: string) {
  const release = heldDraftReads.get(sessionId)
  heldDraftReads.delete(sessionId)
  release?.()
}

async function draftRead(target: { type: 'session'; sessionId: string }) {
  if (heldDraftReads.has(target.sessionId))
    await new Promise<void>((resolve) => heldDraftReads.set(target.sessionId, resolve))
  return success(drafts.get(JSON.stringify(target)) ?? null)
}

// Writes the story makes fail: draft saves and creates, and Sends the Session rejects.
const failing = { draftSaves: false, sends: false }

export function failSelectionWrites(writes: Partial<typeof failing>) {
  Object.assign(failing, writes)
}

function failure(path: string, code: 'INTERNAL_SERVER_ERROR' | 'PRECONDITION_FAILED') {
  const status = code === 'INTERNAL_SERVER_ERROR' ? 500 : 412
  return {
    error: {
      message: `The story failed ${path}.`,
      code: code === 'INTERNAL_SERVER_ERROR' ? -32603 : -32012,
      data: { code, httpStatus: status, path },
    },
  } as unknown as StorybookTrpcResponse
}

function draftReply(value: { target: object; [field: string]: unknown }) {
  drafts.set(JSON.stringify(value.target), value)
  return success(value)
}

function catalogReply(request: StorybookTrpcRequest) {
  const { harness } = request.input as { harness: 'claude' | 'codex' }
  const info = harness === 'codex' ? codexHarnessInfoFixture() : claudeHarnessInfoFixture()
  return success({ info, failure: null })
}

function composerReply(
  request: StorybookTrpcRequest,
): StorybookTrpcResponse | Promise<StorybookTrpcResponse> | null {
  switch (request.path) {
    case 'harnessCatalogRead':
      return catalogReply(request)
    case 'composerDraftRead':
      return draftRead(request.input as { type: 'session'; sessionId: string })
    case 'composerDraftCreate':
    case 'composerDraftSave':
      if (failing.draftSaves) return failure(request.path, 'INTERNAL_SERVER_ERROR')
      return draftWrite(request)
    case 'sessionSubmit':
      return failing.sends ? failure(request.path, 'PRECONDITION_FAILED') : null
    default:
      return null
  }
}

function draftWrite(request: StorybookTrpcRequest) {
  switch (request.path) {
    case 'composerDraftCreate': {
      const input = request.input as {
        target: { type: 'session'; sessionId: string }
        content: object
      }
      return draftReply({
        id: `selection-draft-${input.target.sessionId}`,
        ...input.content,
        target: input.target,
        revision: 0,
        createdAt: 0,
        updatedAt: 0,
      })
    }
    case 'composerDraftSave': {
      const input = request.input as {
        id: string
        expectedRevision: number
        target: object
        content: object
      }
      return draftReply({
        id: input.id,
        ...input.content,
        target: input.target,
        revision: input.expectedRevision + 1,
        createdAt: 0,
        updatedAt: 0,
      })
    }
    default:
      return null
  }
}

async function readFeed(sessionId: string): Promise<SessionFeedSnapshot> {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: `selection-${sessionId}`,
    sessionId,
    chainId: sessionId,
    revision: `selection-${sessionId}`,
    content: [
      {
        id: `selection-row-${sessionId}`,
        kind: 'message',
        role: 'assistant',
        text: `History for ${sessionId}.`,
      },
    ],
  }
}

async function feedReply(request: StorybookTrpcRequest): Promise<StorybookTrpcResponse | null> {
  if (request.path !== 'sessionFeedRead') return null
  const { sessionId } = request.input as { sessionId: string }
  return success(await readFeed(sessionId))
}

function clearSelectionQueries() {
  drafts.clear()
  failSelectionWrites({ draftSaves: false, sends: false })
  for (const release of heldDraftReads.values()) release()
  heldDraftReads.clear()
  queryClient.removeQueries({ queryKey: sessionRosterPathKey })
  queryClient.removeQueries({ queryKey: trpc.projectList.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.projectOpen.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.workspaceList.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.harnessCatalogRead.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.composerDraftRead.pathKey() })
  queryClient.removeQueries({ queryKey: ['sessions', 'feed'] })
  queryClient.removeQueries({ queryKey: ['sessions', 'feed-reading'] })
  queryClient.removeQueries({ queryKey: ['sessions', 'shell-output'] })
  queryClient.removeQueries({ queryKey: ['sessions', 'delegation-usage'] })
}

// Installs the host for one story and returns the story's cleanup. A saved draft is read back as
// stored; a held Session's draft read waits for `releaseDraftRead`.
export function sessionSelectionHost(
  roster: readonly Session[],
  options: { savedDrafts?: Record<string, string>; heldDraftReads?: string[] } = {},
) {
  const before = window.argo
  clearSelectionQueries()
  for (const [sessionId, prompt] of Object.entries(options.savedDrafts ?? {}))
    draftReply({
      id: `selection-draft-${sessionId}`,
      target: { type: 'session', sessionId },
      prompt,
      attachments: [],
      ticketContext: [],
      turnConfiguration: { model: null, effort: null, mode: null },
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
    })
  for (const sessionId of options.heldDraftReads ?? []) heldDraftReads.set(sessionId, () => {})
  window.argo = Object.assign(
    {
      ...before,
      trpc: (async (request) =>
        projectReply(request) ??
        composerReply(request) ??
        (await feedReply(request)) ??
        before.trpc(request)) satisfies typeof window.argo.trpc,
      trpcSubscribe: sessionFeedSubscribe(
        sessionListSubscribe(before.trpcSubscribe, () => roster),
        readFeed,
      ),
    },
    {
      readShellOutput: async () => ({
        type: 'session.shell.output.read',
        output: { state: 'available', tail: 'Checked 187 files.\n' },
      }),
    },
  )
  return () => {
    window.argo = before
    clearSelectionQueries()
  }
}
