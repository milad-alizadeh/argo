import { expect, test } from 'bun:test'
import {
  ClaudeSdkHistoryUnavailableError,
  readClaudeSessionMessages,
  readClaudeSessions,
  readClaudeSubagentMessages,
} from './claude-sdk-history'

test('reads every Claude SDK history page without inspecting transcript files', async () => {
  const offsets: number[] = []
  const sessions = await readClaudeSessions({
    listSessions: async ({ limit, offset }) => {
      expect(limit).toBe(50)
      offsets.push(offset ?? 0)
      return offset === 0
        ? Array.from({ length: 50 }, (_, index) => ({
            sessionId: `first-${index}`,
            summary: 'First',
            lastModified: 2,
            cwd: '/one',
          }))
        : [{ sessionId: 'second', summary: 'Second', lastModified: 1, cwd: '/two' }]
    },
    getSessionMessages: async () => [],
  })

  expect(offsets).toEqual([0, 50])
  expect(sessions.at(-1)?.sessionId).toBe('second')
})

test('reports unavailable SDK history rather than falling back to a transcript reader', async () => {
  await expect(
    readClaudeSessions({
      listSessions: async () => {
        throw new Error('Claude is signed out')
      },
      getSessionMessages: async () => [],
    }),
  ).rejects.toBeInstanceOf(ClaudeSdkHistoryUnavailableError)
})

test('reads every SDK message page for a watched Session', async () => {
  const offsets: number[] = []
  const messages = await readClaudeSessionMessages(
    {
      listSessions: async () => [],
      getSessionMessages: async (_sessionId, { offset }) => {
        offsets.push(offset)
        return offset === 0
          ? Array.from({ length: 50 }, (_, index) => ({
              type: 'user' as const,
              uuid: `message-${index}`,
              session_id: 'session-1',
              message: { content: 'Page one' },
              parent_tool_use_id: null,
              parent_agent_id: null,
            }))
          : [
              {
                type: 'assistant' as const,
                uuid: 'message-50',
                session_id: 'session-1',
                message: { content: 'Page two' },
                parent_tool_use_id: null,
                parent_agent_id: null,
              },
            ]
      },
    },
    'session-1',
  )

  expect(offsets).toEqual([0, 50])
  expect(messages).toHaveLength(51)
})

test('reads every SDK message page for a Subagent', async () => {
  const offsets: number[] = []
  const messages = await readClaudeSubagentMessages(
    {
      listSessions: async () => [],
      getSessionMessages: async () => [],
      getSubagentMessages: async (sessionId, agentId, { offset }) => {
        expect(sessionId).toBe('session-1')
        expect(agentId).toBe('agent-1')
        offsets.push(offset)
        return offset === 0
          ? Array.from({ length: 50 }, (_, index) => ({
              type: 'user' as const,
              uuid: `child-${index}`,
              session_id: 'session-1',
              message: { content: 'Page one' },
              parent_tool_use_id: null,
              parent_agent_id: 'agent-1',
            }))
          : [
              {
                type: 'assistant' as const,
                uuid: 'child-50',
                session_id: 'session-1',
                message: { content: 'Page two' },
                parent_tool_use_id: null,
                parent_agent_id: 'agent-1',
              },
            ]
      },
    },
    'session-1',
    'agent-1',
  )

  expect(offsets).toEqual([0, 50])
  expect(messages).toHaveLength(51)
})

test('returns no Subagent history when the source lacks the SDK capability', async () => {
  const messages = await readClaudeSubagentMessages(
    { listSessions: async () => [], getSessionMessages: async () => [] },
    'session-1',
    'agent-1',
  )

  expect(messages).toBeNull()
})
