import { beforeEach, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'

import type { ProjectSummary } from '@/core/projects/messages'
import { useSessionCreationStore } from '../state/useSessionCreationStore'
import { sendToNewSession } from './useComposerSend'

const PROJECT: ProjectSummary = { id: 'project-1', name: 'argo', path: '/argo' }
const SETUP = { model: 'sonnet', effort: 'high', mode: 'default' }
const COCKPIT = {
  status: 'selected' as const,
  project: PROJECT,
  projects: [PROJECT],
  message: null,
  code: null,
  busy: false,
}

beforeEach(() => {
  useSessionCreationStore.setState({ pending: null })
})

function fakeMutation<Args, Reply>(reply: (args: Args) => Promise<Reply>) {
  const calls: Args[] = []
  return {
    calls,
    mutateAsync: async (args: Args) => {
      calls.push(args)
      return reply(args)
    },
  }
}

// A "+" already opened the optimistic row (#2109): sending reuses it rather than starting a
// second draft, and the Roster's optimistic id resolves to the real one in place.
test('a Send against an already-pending row reuses it instead of beginning a second one', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  const start = fakeMutation<
    { cli: string; cwd: string; prompt: string; setup: unknown },
    { sessionId: string }
  >(async () => ({ sessionId: 'session-new' }))
  const sent = await sendToNewSession({
    cli: 'claude',
    cockpit: COCKPIT,
    identity: { kind: 'pending', sessionId: opened.id, projectId: PROJECT.id },
    navigate: () => undefined as never,
    queryClient: new QueryClient(),
    send: fakeMutation(async () => undefined) as never,
    setFailure: () => {},
    start: start as never,
    prompt: 'hello',
    setup: SETUP,
    attachments: [],
    watchTurn: () => {},
  })
  expect(sent).toBe(true)
  expect(start.calls.length).toBe(1)
  expect(useSessionCreationStore.getState().pending).toEqual({
    stage: 'reconciling',
    id: 'session-new',
    cli: 'claude',
    cwd: PROJECT.path,
  })
})

// One user action produces at most one new Session, even under N rapid Enter presses (#2109).
test('a second rapid Send while the first is still starting is dropped', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  useSessionCreationStore.getState().startSubmission(opened.id)
  const start = fakeMutation<
    { cli: string; cwd: string; prompt: string; setup: unknown },
    { sessionId: string }
  >(async () => ({ sessionId: 'session-new' }))
  const sent = await sendToNewSession({
    cli: 'claude',
    cockpit: COCKPIT,
    identity: { kind: 'pending', sessionId: opened.id, projectId: PROJECT.id },
    navigate: () => undefined as never,
    queryClient: new QueryClient(),
    send: fakeMutation(async () => undefined) as never,
    setFailure: () => {},
    start: start as never,
    prompt: 'hello',
    setup: SETUP,
    attachments: [],
    watchTurn: () => {},
  })
  expect(sent).toBe(false)
  expect(start.calls).toEqual([])
})

// A genuine creation failure clears the optimistic row and sends the reader back to a fresh
// composer rather than leaving them stuck on an id nothing will ever resolve (#2109).
test('a failed start clears the pending row and leaves the composer navigable again', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  const start = fakeMutation<
    { cli: string; cwd: string; prompt: string; setup: unknown },
    { sessionId: string }
  >(async () => {
    throw new Error('boom')
  })
  const navigated: unknown[] = []
  const sent = await sendToNewSession({
    cli: 'claude',
    cockpit: COCKPIT,
    identity: { kind: 'pending', sessionId: opened.id, projectId: PROJECT.id },
    navigate: (...args) => {
      navigated.push(args)
      return undefined as never
    },
    queryClient: new QueryClient(),
    send: fakeMutation(async () => undefined) as never,
    setFailure: () => {},
    start: start as never,
    prompt: 'hello',
    setup: SETUP,
    attachments: [],
    watchTurn: () => {},
  })
  expect(sent).toBe(false)
  expect(useSessionCreationStore.getState().pending).toBeNull()
  expect(navigated).toEqual([['/sessions/new', { replace: true }]])
})
