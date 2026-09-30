import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { Session } from '@/domains/sessions/renderer/types'
import {
  type FeedRead,
  heldDetails,
  heldReads,
  installSessionHost,
} from '@/mocks/sessions/session-story-host'
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
export const heldDraftReads = heldReads()

async function draftRead(target: { type: 'session'; sessionId: string }) {
  await heldDraftReads.wait(target.sessionId)
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

async function readFeed(sessionId: string): Promise<readonly FeedContent[]> {
  return [
    {
      id: `selection-row-${sessionId}`,
      kind: 'message',
      role: 'assistant',
      text: `History for ${sessionId}.`,
    },
  ]
}

function clearSelectionReads() {
  drafts.clear()
  failSelectionWrites({ draftSaves: false, sends: false })
  heldDraftReads.releaseAll()
  heldDetails.releaseAll()
}

// Installs the Session host with the screen's other reads, and returns it; calling it cleans up. A saved draft is read back as
// stored; a held Session's draft read waits for `releaseDraftRead`, and its details read for
// `releaseSessionDetails`.
export function sessionSelectionHost(
  sessions: readonly Session[],
  options: {
    savedDrafts?: Record<string, string>
    heldDraftReads?: string[]
    heldDetails?: string[]
    feed?: FeedRead
    live?: readonly SessionLiveEvent[]
  } = {},
) {
  const before = window.argo
  clearSelectionReads()
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
  for (const sessionId of options.heldDraftReads ?? []) heldDraftReads.hold(sessionId)
  for (const sessionId of options.heldDetails ?? []) heldDetails.hold(sessionId)
  window.argo = {
    ...before,
    trpc: (async (request) =>
      projectReply(request) ??
      composerReply(request) ??
      // Screen stories open the shell inspector and read this tail. Production stays absent.
      (request.path === 'sessionShellOutput'
        ? {
            id: request.id,
            result: { data: { state: 'available' as const, tail: 'Checked 187 files.\n' } },
          }
        : null) ??
      before.trpc(request)) satisfies typeof window.argo.trpc,
  }
  const host = installSessionHost(sessions, {
    feed: options.feed ?? readFeed,
    live: options.live,
  })
  return Object.assign(
    () => {
      host()
      window.argo = before
      clearSelectionReads()
    },
    { reads: host.reads, updates: host.updates, rows: host.rows, change: host.change },
  )
}
