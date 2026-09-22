import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionChain } from '@/domains/sessions/contract/model/transcript/chains'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript/transcript'
import { readShellCommands } from '@/domains/sessions/contract/observation/signals'
import {
  chainBackgroundTasks,
  chainMessages,
} from '@/domains/sessions/main/projection/roster/roster'
import { parseTranscriptLine } from '../records/records'

test('ends a background command whose notice arrived while the Session was idle', () => {
  const call = JSON.stringify({
    type: 'assistant',
    uuid: 'call-1',
    timestamp: '2026-09-15T20:00:00.000Z',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_dev',
          name: 'Bash',
          input: { command: 'bun run dev', run_in_background: true },
        },
      ],
    },
  })
  const notice = JSON.stringify({
    type: 'user',
    uuid: 'notice-1',
    timestamp: '2026-09-15T20:34:02.902Z',
    origin: { kind: 'task-notification' },
    message: {
      role: 'user',
      content:
        '<task-notification>\n<task-id>bq7</task-id>\n<tool-use-id>toolu_dev</tool-use-id>\n<output-file>/tmp/bq7.output</output-file>\n<status>completed</status>\n<summary>Background command "Start the dev app" completed (exit code 0)</summary>\n</task-notification>',
    },
  })
  const records = [call, notice].flatMap((line) => parseTranscriptLine(line) ?? [])
  const chain: SessionChain = {
    id: 'session',
    retiredIds: [],
    files: [transcriptFileFrom('session.jsonl', { sessionId: 'session', records })],
    originUnread: false,
  }
  const [command] = readShellCommands(chainMessages(chain), chainBackgroundTasks(chain))
  assert.equal(command?.state, 'completed')
  assert.equal(command?.endedAt, '2026-09-15T20:34:02.902Z')
})
