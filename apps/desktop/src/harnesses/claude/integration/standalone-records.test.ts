import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from '../sessions/records/records'

test('reads a standalone permission mode as neutral Session setup', () => {
  assert.deepEqual(
    parseTranscriptLine(
      '{"type":"permission-mode","permissionMode":"bypassPermissions","sessionId":"s-1"}',
    ),
    {
      kind: 'setup',
      startsTurn: false,
      model: null,
      effort: null,
      mode: 'bypassPermissions',
    },
  )
})

test('reads a standalone local command at its prompt boundary', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'system',
      subtype: 'local_command',
      uuid: 'command-1',
      parentUuid: null,
      timestamp: '2026-09-16T00:00:00.000Z',
      content:
        '<command-name>/implement</command-name><command-message>implement</command-message><command-args>2389</command-args>',
    }),
  )
  assert.equal(record?.kind, 'message')
  if (record?.kind !== 'message') assert.fail('expected a local command message')
  assert.deepEqual(record.blocks, [{ shape: 'event', event: 'command', text: '/implement 2389' }])
})
