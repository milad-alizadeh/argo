import { expect, test } from 'bun:test'
import { createClaudeSdkDriveAdapter } from '@/harnesses/claude/agent-sdk/claude-sdk-drive-adapter'

test('routes a legacy Claude start through the managed adapter', async () => {
  const commands: unknown[] = []
  const adapter = createClaudeSdkDriveAdapter({
    adapter: {
      execute: async (command) => {
        commands.push(command)
        return {
          kind: 'accepted',
          projection: {
            session: { harness: 'claude', nativeId: 'native-1' },
            posture: 'managed',
            sourceHealth: 'ready',
            revision: 1,
            workspace: { id: 'workspace-1' },
            status: 'idle',
            title: null,
            turns: [],
            messages: [],
            toolCalls: [],
            pendingApprovals: [],
            pendingQuestions: [],
            usage: { inputTokens: 0, outputTokens: 0 },
          },
        }
      },
      subscribe: () => () => {},
    },
    workspaceForCwd: async () => ({ kind: 'existing', workspaceId: 'workspace-1' }),
  })

  await expect(
    adapter.start({ cwd: '/repository', prompt: 'Hello', setup: {}, attachments: [] }),
  ).resolves.toEqual({
    sessionId: 'native-1',
  })
  expect(commands).toEqual([
    {
      type: 'session.start',
      harness: 'claude',
      prompt: 'Hello',
      workspace: { kind: 'existing', workspaceId: 'workspace-1' },
    },
  ])
})
