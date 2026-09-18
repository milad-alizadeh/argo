import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionReader } from '../../../core/sessions/reader.ts'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { fixtureRoot } from './session-fixtures'

function readFeed(value: unknown, root: string) {
  return createSessionReader([claudeSessionSource({ transcripts: root })]).readSessionFeed(value)
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
    group.calls.map(({ label, lineCounts, status }) => ({ label, lineCounts, status })),
    [
      { label: 'Ran bun test', lineCounts: null, status: 'succeeded' },
      { label: 'Read app.ts', lineCounts: null, status: 'failed' },
      { label: 'Edited app.ts', lineCounts: { added: 1, removed: 1 }, status: 'running' },
    ],
  )
  assert.equal(reply.rows[1]?.shape, 'prose')
  const unknownGroup = reply.rows[2]
  assert.equal(unknownGroup?.shape, 'tool-group')
  assert.equal(unknownGroup?.label, 'Ran a command')
  const [unknown] = unknownGroup?.calls ?? []
  assert.equal(unknown?.label, 'Ran NewTool')
  assert.equal(unknown?.text, 'select:Read')
}

test('keeps each line of a multi-line edit in one unified patch', async (context) => {
  const root = await fixtureRoot(context, [])
  await writeFile(
    path.join(root, 'project-one', 'patch.jsonl'),
    `${JSON.stringify({
      type: 'assistant',
      uuid: 'edit',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'patch',
            name: 'Edit',
            input: {
              file_path: 'src/app.ts',
              old_string: 'const oldValue = 1\nreturn oldValue',
              new_string: 'const newValue = 2\nreturn newValue',
            },
          },
        ],
      },
    })}\n`,
  )
  const reply = await readFeed(
    {
      version: 1,
      type: 'session.feed',
      requestId: 'patch',
      sessionId: 'patch',
      delegationId: null,
      revision: null,
    },
    root,
  )
  assert.equal(reply.type, 'session.feed.read')
  const [group] = reply.rows
  assert.equal(group?.shape, 'tool-group')
  const [row] = group?.calls ?? []
  assert.equal(row?.evidence?.kind, 'diff')
  assert.equal(
    row?.evidence?.source,
    '@@ -1,2 +1,2 @@\n-const oldValue = 1\n-return oldValue\n+const newValue = 2\n+return newValue',
  )
})

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
          { type: 'tool_use', id: 'unknown', name: 'NewTool', input: { query: 'select:Read' } },
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
