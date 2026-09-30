import path from 'node:path'
import type { MockHistoryLines } from '../../sessions/mock-history-lines'

// Transcript records as the Claude CLI appends them, each linked to the one before it.
export function mockClaudeHistoryLines(): MockHistoryLines {
  let parent: string | null = null
  let count = 0
  const record = (type: 'user' | 'assistant', message: Record<string, unknown>) => {
    count += 1
    const uuid = `record-${count}`
    const line = JSON.stringify({ type, uuid, parentUuid: parent, message })
    parent = uuid
    return line
  }
  return {
    file: (root, nativeId) => path.join(root, '-Users-reader-project', `${nativeId}.jsonl`),
    prompt: (text) => [record('user', { role: 'user', content: text })],
    command: (command) => {
      const callId = `call-${count + 1}`
      return [
        record('assistant', {
          role: 'assistant',
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: callId, name: 'Bash', input: { command } }],
        }),
        record('user', {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: callId, content: 'done' }],
        }),
      ]
    },
    answer: (text) => [
      record('assistant', {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text }],
      }),
    ],
    bookkeeping: () => JSON.stringify({ type: 'last-prompt', leafUuid: parent }),
  }
}
