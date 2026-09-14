import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { createClaudeSessionReader } from '../sessions/read-sessions.ts'
import { fixtureRoot } from './session-fixtures'

function readFeed(value: unknown, root: string) {
  return createClaudeSessionReader({ transcripts: root }).readSessionFeed(value)
}

function assertToolRows(reply) {
  assert.equal(reply.type, 'session.feed.read')
  assert.deepEqual(
    reply.rows.map((row) => row.shape),
    ['tool-group', 'prose', 'tool-group'],
  )
  assert.equal(
    reply.rows.some((row) => row.shape === 'source'),
    false,
  )
  const [group] = reply.rows
  assert.equal(group.shape, 'tool-group')
  assert.equal(group.label, 'Ran a command, edited a file, read a file')
  assert.deepEqual(
    group.calls.map(({ label, detail, status }) => ({ label, detail, status })),
    [
      { label: 'Ran bun test', detail: null, status: 'succeeded' },
      { label: 'Read app.ts', detail: null, status: 'failed' },
      { label: 'Edited app.ts', detail: '+1 −1', status: 'running' },
    ],
  )
  assert.equal(reply.rows[1]?.shape, 'prose')
  const unknownGroup = reply.rows[2]
  assert.equal(unknownGroup?.shape, 'tool-group')
  assert.equal(unknownGroup?.label, 'Called a tool')
  const [unknown] = unknownGroup?.calls ?? []
  assert.equal(unknown?.label, 'Called an unclassified tool')
}

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
          { type: 'text', text: 'I need to inspect one more thing.' },
          { type: 'tool_use', id: 'unknown', name: 'NewTool', input: {} },
        ],
      },
    })}\n${JSON.stringify({
      type: 'user',
      uuid: 'result',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'command', content: '1 pass' },
          {
            type: 'tool_result',
            tool_use_id: 'file',
            content: 'permission denied',
            is_error: true,
          },
          { type: 'tool_result', tool_use_id: 'unknown', content: 'recorded output' },
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
      delegationId: null,
      revision: null,
    },
    root,
  )
  assertToolRows(reply)
})
