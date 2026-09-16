import { QueryClient } from '@tanstack/react-query'
import type { ProjectSummary } from '@/core/projects/messages'
import type { sendToNewSession } from './send-turn'

export const PROJECT: ProjectSummary = { id: 'project-1', name: 'argo', path: '/argo' }
export const SETUP = { model: 'sonnet', effort: 'high', mode: 'default' }
export const COCKPIT = {
  status: 'selected' as const,
  project: PROJECT,
  projects: [PROJECT],
  message: null,
  code: null,
  busy: false,
}

// A mutation that records each call and answers with `reply`, standing in for the IPC round trip.
export function mockMutation<Args, Reply>(reply: (args: Args) => Promise<Reply>) {
  const calls: Args[] = []
  return {
    calls,
    mutateAsync: async (args: Args) => {
      calls.push(args)
      return reply(args)
    },
  }
}

export function mockStart(reply: () => Promise<{ sessionId: string }>) {
  return mockMutation<
    { cli: string; cwd: string; prompt: string; setup: unknown },
    { sessionId: string }
  >(reply)
}

type NewSessionDeps = Parameters<typeof sendToNewSession>[0]

export function newSessionDeps(
  start: ReturnType<typeof mockStart>,
  identity: NewSessionDeps['identity'],
  navigate: NewSessionDeps['navigate'] = () => undefined as never,
): NewSessionDeps {
  return {
    cli: 'claude',
    cockpit: COCKPIT,
    identity,
    navigate,
    queryClient: new QueryClient(),
    send: mockMutation(async () => undefined) as never,
    setFailure: () => {},
    start: start as never,
    turn: { prompt: 'hello', setup: SETUP, attachments: [] } as never,
    watchTurn: () => {},
  }
}
