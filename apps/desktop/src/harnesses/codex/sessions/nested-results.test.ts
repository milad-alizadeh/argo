import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript'
import { answeringEveryNestedCall } from './nested-results'
import { readToolRecord } from './tool-calls'

const RECORD = { timestamp: '2026-09-18T17:08:08.000Z' }

function record(payload: Record<string, unknown>): TranscriptRecord {
  const read = readToolRecord(RECORD, payload)
  assert.notEqual(read, null)
  return read as TranscriptRecord
}

test('answers every call of a script from its one output, even with a JavaScript workdir', () => {
  const script = [
    'const wd = "/repo";',
    'const a = await tools.exec_command({"cmd":"bun test","workdir":wd});',
    'const b = await tools.exec_command({"cmd":"bun run lint","workdir":wd});',
    'const c = await tools.exec_command({"cmd":"bun run build","workdir":wd});',
  ].join('\n')
  const [calls, results] = answeringEveryNestedCall([
    record({ type: 'custom_tool_call', id: 'ctc', call_id: 'call', name: 'exec', input: script }),
    record({
      type: 'custom_tool_call_output',
      id: 'ctco',
      call_id: 'call',
      output: [
        { type: 'input_text', text: 'Script completed\nWall time 0.3 seconds\nOutput:\n' },
        { type: 'input_text', text: 'Process exited with code 0\nall green' },
      ],
    }),
  ])
  assert.equal(calls?.kind, 'message')
  assert.equal(results?.kind, 'message')
  if (calls?.kind !== 'message' || results?.kind !== 'message') return
  assert.deepEqual(
    calls.toolCalls.map((call) => (call.kind === 'execute' ? call.command : null)),
    ['bun test', 'bun run lint', 'bun run build'],
  )
  assert.deepEqual(results.answeredCalls, ['call:0', 'call:1', 'call:2'])
  assert.equal(
    results.toolResults?.every((result) => !result.failed),
    true,
  )
})

test('keeps a write_stdin poll out of the Feed, as Codex does', () => {
  const script =
    'const r = await tools.write_stdin({"session_id":81195,"chars":"","yield_time_ms":30000});\ntext(JSON.stringify(r));'
  const payload = {
    type: 'custom_tool_call',
    id: 'ctc',
    call_id: 'call',
    name: 'exec',
    input: script,
  }
  assert.equal(readToolRecord(RECORD, payload), null)
})

test('keeps a top-level wait poll out of the Feed too', () => {
  const payload = {
    type: 'function_call',
    id: 'fc',
    call_id: 'call',
    name: 'wait',
    arguments: '{"cell_id":"768","yield_time_ms":30000,"max_tokens":30000}',
  }
  assert.equal(readToolRecord(RECORD, payload), null)
})

// The calls one exec script makes, as `{ name, <field> }` pairs.
function scriptCalls(script: string, field: string) {
  const read = record({
    type: 'custom_tool_call',
    id: 'ctc',
    call_id: 'c',
    name: 'exec',
    input: script,
  })
  assert.equal(read.kind, 'message')
  if (read.kind !== 'message') return []
  return read.toolCalls.map((call) => {
    const value = (() => {
      switch (call.kind) {
        case 'edit':
          return call.files[0]?.diff
        case 'search':
          return call.query
        default:
          return null
      }
    })()
    return { name: call.kind, [field]: value }
  })
}

test('reads an apply_patch call through the constant its script declared', () => {
  const script = [
    'const patch = "*** Begin Patch\\n*** Update File: /repo/src/app.ts\\n@@\\n-old\\n+new\\n*** End Patch";',
    'const r = await tools.apply_patch(patch);',
    'text(typeof r === "string" ? r : JSON.stringify(r));',
  ].join('\n')
  assert.deepEqual(scriptCalls(script, 'patch'), [
    {
      name: 'edit',
      patch: 'Update File: /repo/src/app.ts\n@@ -0,0 +0,0 @@\n-old\n+new',
    },
  ])
})

test('names a web search by its first query, quotes unescaped, as Codex does', () => {
  const script = [
    'const r = await tools.web__run({search_query:[',
    ' {q:"\\"Steerline\\" software app company"},',
    ' {q:"\\"Foredeck\\" software app company"}',
    '],response_length:"long"}); text(r);',
  ].join('\n')
  assert.deepEqual(scriptCalls(script, 'query'), [
    { name: 'search', query: '"Steerline" software app company' },
  ])
})

test('leaves a plain function call and its output as they are', () => {
  const records = [
    record({
      type: 'function_call',
      id: 'fc',
      call_id: 'send',
      name: 'send_message',
      arguments: '{}',
    }),
    record({ type: 'function_call_output', id: 'fco', call_id: 'send', output: 'ok' }),
  ]
  assert.deepEqual(answeringEveryNestedCall(records), records)
})
