import { beforeEach, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'

import type { ProjectSummary } from '@/core/projects/messages'
import { useSessionCreationStore } from '../state/use-session-creation-store'
import { sendToNewSession, sendToSelected } from './send-turn'

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

// The identity's session variant routes a Send to that Session, never a new one.
test('a Send with a selected Session sends to it', async () => {
  const send = fakeMutation<{ prompt: string; sessionId: string; setup: unknown }, void>(
    async () => undefined,
  )
  const watched: unknown[] = []
  const sent = await sendToSelected({
    queryClient: new QueryClient(),
    since: null,
    selectedSessionId: 'session-1',
    send: send as never,
    setFailure: () => {},
    turn: { prompt: 'hello', setup: SETUP, attachments: [] } as never,
    watchTurn: (...args) => watched.push(args),
  })
  expect(sent).toBe(true)
  expect(send.calls).toEqual([
    { prompt: 'hello', sessionId: 'session-1', setup: SETUP, attachments: [] },
  ])
  expect(watched).toEqual([['session-1', SETUP, null]])
})

// The identity's draft variant routes a Send to starting a fresh Session, and moves there.
test('a Send with no prior Session starts one and navigates to it', async () => {
  const start = fakeMutation<
    { cli: string; cwd: string; prompt: string; setup: unknown },
    { sessionId: string }
  >(async () => ({ sessionId: 'session-new' }))
  const navigated: unknown[] = []
  const sent = await sendToNewSession({
    cli: 'claude',
    cockpit: COCKPIT,
    identity: { kind: 'draft', projectId: PROJECT.id },
    navigate: (...args) => {
      navigated.push(args)
      return undefined as never
    },
    queryClient: new QueryClient(),
    send: fakeMutation(async () => undefined) as never,
    setFailure: () => {},
    start: start as never,
    turn: { prompt: 'hello', setup: SETUP, attachments: [] } as never,
    watchTurn: () => {},
  })
  expect(sent).toBe(true)
  expect(start.calls).toEqual([
    { cli: 'claude', cwd: '/argo', prompt: 'hello', setup: SETUP, attachments: [] },
  ])
  expect(navigated).toEqual([['/sessions/session-new', { replace: true, state: 'focus-composer' }]])
})
