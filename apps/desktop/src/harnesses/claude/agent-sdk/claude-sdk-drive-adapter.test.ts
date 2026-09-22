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
      resume: async () => {
        throw new Error('resume should not run for session.start')
      },
      projection: () => null,
    },
    workspaceForCwd: async () => ({ kind: 'existing', workspaceId: 'workspace-1' }),
  })

  await expect(
    adapter.start({
      cwd: '/repository',
      prompt: 'Hello',
      deferInitialTurn: true,
      setup: {},
      attachments: [],
    }),
  ).resolves.toEqual({
    sessionId: 'native-1',
  })
  expect(commands).toEqual([
    {
      type: 'session.start',
      harness: 'claude',
      prompt: 'Hello',
      startTurn: false,
      workspace: { kind: 'existing', workspaceId: 'workspace-1' },
    },
  ])
})

test('resumes an external Claude Session when a queued Turn is steered', async () => {
  const resumes: unknown[] = []
  const adapter = createClaudeSdkDriveAdapter({
    adapter: {
      execute: async () => {
        throw new Error('execute should not run for session.steer')
      },
      resume: async (request) => {
        resumes.push(request)
        return { kind: 'accepted', projection: {} as never }
      },
      projection: () => null,
    },
    workspaceForCwd: async () => ({ kind: 'existing', workspaceId: 'workspace-1' }),
  })

  await expect(
    adapter.steer?.({
      attachments: [],
      sessionId: 'native-1',
      cwd: '/repository',
      prompt: 'Continue.',
    }),
  ).resolves.toEqual({ ok: true })
  expect(resumes).toEqual([
    {
      session: { harness: 'claude', nativeId: 'native-1' },
      workspace: { kind: 'existing', workspaceId: 'workspace-1' },
      cwd: '/repository',
      prompt: 'Continue.',
    },
  ])
})

test('reads a managed pending approval through the legacy Permission surface', async () => {
  const adapter = createClaudeSdkDriveAdapter({
    adapter: {
      execute: async () => ({ kind: 'uncertain' }),
      resume: async () => ({ kind: 'uncertain' }),
      projection: () => ({ pendingApprovals: [{ id: 'approval-1', summary: 'Bash' }] }) as never,
    },
    workspaceForCwd: async () => ({ kind: 'existing', workspaceId: 'workspace-1' }),
  })

  await expect(adapter.readPermission({ sessionId: 'native-1' })).resolves.toEqual({
    permission: { id: 'approval-1', sessionId: 'native-1', description: 'Bash' },
  })
})
