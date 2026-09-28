import { sessionListTrpc } from '@/domains/sessions/renderer/session-fixtures'
import type { Session } from '@/domains/sessions/renderer/types'
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

function draftReply(value: { target: object; [field: string]: unknown }) {
  drafts.set(JSON.stringify(value.target), value)
  return success(value)
}

function catalogReply(request: StorybookTrpcRequest) {
  const { harness } = request.input as { harness: 'claude' | 'codex' }
  const info = harness === 'codex' ? codexHarnessInfoFixture() : claudeHarnessInfoFixture()
  return success({ info, failure: null })
}

function composerReply(request: StorybookTrpcRequest): StorybookTrpcResponse | null {
  switch (request.path) {
    case 'harnessCatalogRead':
      return catalogReply(request)
    case 'composerDraftRead':
      return success(drafts.get(JSON.stringify(request.input)) ?? null)
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

function feedReply(request: StorybookTrpcRequest): StorybookTrpcResponse | null {
  if (request.path !== 'sessionFeedRead') return null
  const { sessionId } = request.input as { sessionId: string }
  return success({
    version: 1,
    type: 'session.feed.read',
    requestId: `selection-${sessionId}`,
    sessionId,
    chainId: sessionId,
    revision: `selection-${sessionId}`,
    olderCursor: null,
    content: [
      {
        id: `selection-row-${sessionId}`,
        kind: 'message',
        role: 'assistant',
        text: `History for ${sessionId}.`,
      },
    ],
  })
}

function clearSelectionQueries() {
  drafts.clear()
  queryClient.removeQueries({ queryKey: trpc.sessionList.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.projectList.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.projectOpen.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.workspaceList.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.harnessCatalogRead.pathKey() })
  queryClient.removeQueries({ queryKey: trpc.composerDraftRead.pathKey() })
  queryClient.removeQueries({ queryKey: ['sessions', 'feed'] })
  queryClient.removeQueries({ queryKey: ['sessions', 'shell-output'] })
  queryClient.removeQueries({ queryKey: ['sessions', 'delegation-usage'] })
}

// Installs the host for one story and returns the story's cleanup.
export function sessionSelectionHost(roster: readonly Session[]) {
  const before = window.argo
  clearSelectionQueries()
  const sessionTrpc = sessionListTrpc(before.trpc, () => roster)
  window.argo = Object.assign(
    {
      ...before,
      trpc: (async (request) =>
        projectReply(request) ??
        composerReply(request) ??
        feedReply(request) ??
        sessionTrpc(request)) satisfies typeof window.argo.trpc,
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
