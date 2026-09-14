import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from './records'

test('reads a sent command as its visible source text', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'command-1',
    message: {
      role: 'user',
      content:
        '<command-name>/implement</command-name>\n<command-message>implement</command-message>\n<command-args>1847</command-args>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: '/implement 1847' },
  ])
})

test('does not expose incomplete command tags', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'command-2',
    message: { role: 'user', content: '<command-message>implement</command-message>' },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: 'implement' },
  ])
})

// A background task's delivery arrives as a user turn holding this envelope, embedded JSON
// result included. Argo shows the summary, not the envelope (#2054).
test('reads a background task notification as its summary, not the raw envelope', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'task-1',
    message: {
      role: 'user',
      content:
        '<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent "Consolidate stories" finished</summary>\n<result>{"files":[{"path":"a.tsx"}]}</result>\n</task-notification>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.deepEqual(record, {
    kind: 'command-output',
    uuid: 'task-1',
    timestamp: null,
    text: 'Agent "Consolidate stories" finished',
  })
})

test('drops a task notification with no summary rather than guess', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'task-2',
    message: {
      role: 'user',
      content: '<task-notification><status>completed</status></task-notification>',
    },
  })
  const record = parseTranscriptLine(line)
  assert.equal(record?.kind === 'message' ? record.blocks[0]?.shape : record?.kind, 'prose')
})
