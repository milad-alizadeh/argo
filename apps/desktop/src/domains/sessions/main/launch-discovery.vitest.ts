import { expect, test } from 'vitest'
import { discoverStartedSession } from './launch-discovery'

const intent = {
  id: 'intent-1',
  harness: 'claude' as const,
  projectId: 'project-1',
  workspaceId: 'workspace-1',
  prompt: 'Begin.',
  createdAt: 1_000_000,
  nativeId: null,
}

test('a later same-prompt Session cannot claim an abandoned launch intent', () => {
  expect(
    discoverStartedSession(intent, [
      {
        nativeId: 'later-session',
        workspaceId: 'workspace-1',
        firstPrompt: 'Begin.',
        startedAt: intent.createdAt + 120_001,
      },
    ]),
  ).toEqual({ kind: 'ambiguous' })
  expect(
    discoverStartedSession(intent, [
      {
        nativeId: 'started-session',
        workspaceId: 'workspace-1',
        firstPrompt: 'Begin.',
        startedAt: intent.createdAt + 10_000,
      },
    ]),
  ).toEqual({ kind: 'found', nativeId: 'started-session' })
})
