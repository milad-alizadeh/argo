import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { readFeed } from '../sessions/read-sessions.ts'
import { fixtureRoot } from './session-fixtures'

test('projects recorded command, file, and edit evidence', async (context) => {
  const root = await fixtureRoot(context, [])
  await writeFile(
    path.join(root, 'project-one', 'evidence.jsonl'),
    `${JSON.stringify({
      type: 'assistant',
      uuid: 'tool',
      message: {
        content: [
          { type: 'tool_use', id: 'command', name: 'Bash', input: { command: 'bun test' } },
          { type: 'tool_use', id: 'file', name: 'Read', input: { file_path: 'src/app.ts' } },
          {
            type: 'tool_use',
            id: 'edit',
            name: 'Edit',
            input: { file_path: 'src/app.ts', old_string: 'old', new_string: 'new' },
          },
        ],
      },
    })}\n${JSON.stringify({
      type: 'user',
      uuid: 'result',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'command', content: '1 pass' },
          { type: 'tool_result', tool_use_id: 'file', content: 'export {}' },
        ],
      },
    })}`,
  )
  const reply = await readFeed(
    {
      version: 1,
      type: 'session.feed',
      requestId: 'evidence',
      sessionId: 'evidence',
      revision: null,
    },
    root,
  )
  assert.equal(reply.type, 'session.feed.read')
  assert.equal(reply.rows.filter((row) => row.shape === 'tool').length, 3)
})
