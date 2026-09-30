import path from 'node:path'
import type { MockHistoryLines } from '../../sessions/mock-history-lines'

// Rollout records as Codex appends them; a work item is written once, when it completes.
export function mockCodexHistoryLines(): MockHistoryLines {
  let count = 0
  const completed = (item: Record<string, unknown>) => {
    count += 1
    return JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        turn_id: 'turn-1',
        item: { id: `item-${count}`, ...item },
      },
    })
  }
  return {
    file: (root, nativeId) =>
      path.join(root, '2026', '09', '30', `rollout-2026-09-30T10-00-00-${nativeId}.jsonl`),
    prompt: (text) => [completed({ type: 'UserMessage', content: [{ type: 'text', text }] })],
    command: (command) => [
      completed({
        type: 'CommandExecution',
        command: command.split(' '),
        cwd: 'file:///Users/reader/project',
        source: 'unified_exec_startup',
        status: 'completed',
        aggregated_output: 'done',
        exit_code: 0,
      }),
    ],
    answer: (text) => [
      completed({ type: 'AgentMessage', content: [{ type: 'Text', text }], phase: 'final_answer' }),
    ],
    bookkeeping: () => JSON.stringify({ type: 'event_msg', payload: { type: 'token_count' } }),
  }
}
