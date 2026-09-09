import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from '../src/sessions/records.ts'
import { withoutBlocks } from '../src/sessions/transcript-file.ts'
import { fixtureFile } from './session-fixtures.mjs'

test('names the Session from the file name, not from a record inside it', async () => {
  const file = await fixtureFile('unparseableBody')
  assert.equal(file.sessionId, 'unparseableBody')
  assert.equal(file.records.filter((record) => record.kind === 'message').length, 0)
})

test('keeps every line it cannot read rather than shortening the history', async () => {
  const file = await fixtureFile('unparseableBody')
  assert.equal(file.unreadableLines, 5)
  const damaged = file.records.filter((record) => record.kind === 'unreadable')
  assert.deepEqual(
    damaged.map((record) => record.line),
    ['{not json', '[]', '"a string"', 'null', '{"type":"user"'],
  )
})

test('reads a block it cannot draw as its own type and its own JSON', async () => {
  const file = await fixtureFile('titledHeadless')
  const reply = file.records.findLast((record) => record.kind === 'message')
  assert.deepEqual(reply.blocks[0], { shape: 'prose', text: 'Done' })
  assert.equal(reply.blocks[1].shape, 'source')
  assert.equal(reply.blocks[1].label, 'image')
  assert.equal(JSON.parse(reply.blocks[1].source).source.type, 'base64')
})

test('reads the entry word and the two title sources', async () => {
  const file = await fixtureFile('titledHeadless')
  const messages = file.records.filter((record) => record.kind === 'message')
  assert.deepEqual([...new Set(messages.map((message) => message.entry))], ['headless'])
  assert.deepEqual(
    file.records.filter((record) => record.kind === 'title'),
    [
      { kind: 'title', title: 'Summarised name', source: 'summarised' },
      { kind: 'title', title: 'The name a person typed', source: 'custom' },
    ],
  )
})

test('keeps the opening prompt past the blocks the Roster pass drops', async () => {
  const file = await fixtureFile('titledHeadless')
  assert.equal(file.openingPrompt, 'Run the headless pass')
  const summary = withoutBlocks(file)
  assert.equal(summary.openingPrompt, 'Run the headless pass')
  assert.deepEqual(
    summary.records
      .filter((record) => record.kind === 'message')
      .flatMap((message) => message.blocks),
    [],
  )
})

test('skips bookkeeping records and reads a resume link', () => {
  assert.equal(parseTranscriptLine('{"type":"mode","mode":"default"}'), null)
  assert.equal(parseTranscriptLine('   '), null)
  assert.deepEqual(parseTranscriptLine('{"type":"last-prompt","leafUuid":"a-1"}'), {
    kind: 'link',
    leafUuid: 'a-1',
  })
})

test('refuses a message record with no identity', () => {
  const line = '{"type":"user","message":{"role":"user","content":"no uuid"}}'
  assert.deepEqual(parseTranscriptLine(line), { kind: 'unreadable', line })
})
