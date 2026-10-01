import { describe, expect, test } from 'bun:test'
import type { SessionUpdate } from '@agentclientprotocol/sdk'
import { AcpFeedProjection } from './acp-feed-projection'

function projectAll(updates: SessionUpdate[]) {
  const projection = new AcpFeedProjection()
  return { rows: updates.map((update) => projection.project(update)), projection }
}

describe('AcpFeedProjection', () => {
  test('draws a Plan with its steps done and in total', () => {
    const { rows } = projectAll([
      {
        sessionUpdate: 'plan',
        entries: [
          { content: 'Read the code', status: 'completed', priority: 'high' },
          { content: 'Write the test', status: 'in_progress', priority: 'medium' },
        ],
      },
    ])
    expect(rows).toEqual([
      {
        id: 'acp-plan',
        kind: 'plan',
        text: '- Read the code\n- Write the test',
        progress: { completed: 1, total: 2 },
      },
    ])
  })

  test('grows one message row across chunks that share a message id', () => {
    const { rows } = projectAll([
      {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'msg-1',
        content: { type: 'text', text: 'pine' },
      },
      {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'msg-1',
        content: { type: 'text', text: 'apple' },
      },
    ])
    expect(rows.at(-1)).toEqual({
      id: 'msg-1',
      kind: 'message',
      role: 'assistant',
      text: 'pineapple',
    })
  })

  test('gives chunks without a message id one row per contiguous run', () => {
    const { rows } = projectAll([
      { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'hi' } },
      { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'a' } },
      { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'b' } },
    ])
    expect(rows.map((row) => row?.id)).toEqual([
      'acp-prompt-1',
      'acp-assistant-1',
      'acp-assistant-1',
    ])
    expect(rows.at(-1)).toMatchObject({ text: 'ab' })
  })

  test('keys a sent prompt and its replayed copy by the same place among prompts', () => {
    const live = new AcpFeedProjection()
    const sent = [live.openPrompt('first'), live.openPrompt('second')]
    const { rows } = projectAll([
      {
        sessionUpdate: 'user_message_chunk',
        messageId: 'u-1',
        content: { type: 'text', text: 'first' },
      },
      {
        sessionUpdate: 'agent_message_chunk',
        messageId: 'a-1',
        content: { type: 'text', text: 'ok' },
      },
      {
        sessionUpdate: 'user_message_chunk',
        messageId: 'u-2',
        content: { type: 'text', text: 'second' },
      },
    ])
    expect(rows.filter((row) => row?.kind === 'message' && row.role === 'user')).toEqual(sent)
  })
})

describe('AcpFeedProjection tools and metadata', () => {
  test('keeps a tool call title and input when an update brings only its status', () => {
    const { rows } = projectAll([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'call-1',
        title: 'Read README.md',
        kind: 'read',
        status: 'pending',
        rawInput: { path: 'README.md' },
      },
      {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'call-1',
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: '# Argo' } }],
      },
    ])
    expect(rows.at(-1)).toEqual({
      id: 'call-1',
      kind: 'tool',
      callId: 'call-1',
      name: 'Read README.md',
      status: 'completed',
      input: { path: 'README.md' },
      output: [{ kind: 'text', text: '# Argo' }],
      summary: null,
      presentation: { kind: 'read', label: 'Read README.md' },
    })
  })

  test('draws no row for Session metadata and counts updates it cannot draw', () => {
    const { rows, projection } = projectAll([
      { sessionUpdate: 'available_commands_update', availableCommands: [] },
      { sessionUpdate: 'notice', severity: 'info', title: 'Heads up' },
    ])
    expect(rows).toEqual([null, null])
    expect(projection.rejected).toBe(1)
  })

  test('keeps the text of a tool result and counts the media it cannot draw', () => {
    const { rows, projection } = projectAll([
      {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Screenshot',
        status: 'completed',
        content: [
          { type: 'content', content: { type: 'text', text: 'Saved.' } },
          { type: 'content', content: { type: 'image', data: 'AA==', mimeType: 'image/png' } },
          { type: 'terminal', terminalId: 'terminal-1' },
        ],
      },
    ])
    expect(rows[0]).toMatchObject({ output: [{ kind: 'text', text: 'Saved.' }] })
    expect(projection.rejected).toBe(2)
  })
})
