import { QueryClient } from '@tanstack/react-query'
import type { ProjectSummary } from '../../src/domains/projects/contract/messages'
import type { sendToNewSession } from '../../src/domains/sessions/renderer/hooks/send-turn'
import type { TurnSetup } from '../../src/domains/sessions/renderer/turn-setup/turn-setup'

export const PROJECT: ProjectSummary = { id: 'project-1', name: 'argo', path: '/argo' }
export const SETUP: TurnSetup = { model: 'sonnet', effort: 'high', mode: 'default' }
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

type NewSessionDeps = Parameters<typeof sendToNewSession>[0]

export function mockStart(reply: () => Promise<{ sessionId: string }>) {
  return mockMutation<Parameters<NewSessionDeps['start']['mutateAsync']>[0], { sessionId: string }>(
    reply,
  )
}

export function newSessionDeps(
  start: ReturnType<typeof mockStart>,
  identity: NewSessionDeps['identity'],
  navigate: NewSessionDeps['navigate'] = () => {},
): NewSessionDeps {
  return {
    harness: 'claude',
    cockpit: COCKPIT,
    identity,
    navigate,
    queryClient: new QueryClient(),
    setFailure: () => {},
    start,
    turn: { prompt: 'hello', setup: SETUP, attachments: [] },
    watchTurn: () => {},
  }
}
