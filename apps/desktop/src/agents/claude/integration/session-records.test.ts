import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from '../sessions/records.ts'
import { withoutBlocks } from '../sessions/transcript-file.ts'
import { fixtureFile } from './session-fixtures'

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

// A thinking block is a Thought, never a Message. One with no text field is not a Thought Argo
// can read, so it falls back to its own source like any other block it cannot draw.
test('reads a thinking block as a Thought, and a malformed one as source', () => {
  const line = (content) =>
    JSON.stringify({ type: 'assistant', uuid: 'a', message: { role: 'assistant', content } })
  const read = parseTranscriptLine(line([{ type: 'thinking', thinking: '' }]))
  assert.deepEqual(read.blocks, [{ shape: 'thought', text: '' }])
  const malformed = parseTranscriptLine(line([{ type: 'thinking' }]))
  assert.equal(malformed.blocks[0].shape, 'source')
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

test('reads slash commands as the words the person typed', async () => {
  const file = await fixtureFile('harnessNoise')
  const prompts = file.records
    .filter((record) => record.kind === 'message' && record.role === 'user')
    .flatMap((record) => record.blocks)
    .flatMap((block) =>
      block.shape === 'prose' || (block.shape === 'event' && block.event === 'command')
        ? [block.text]
        : [],
    )

  assert.deepEqual(prompts, [
    '/effort',
    '/implement 318 open storybook while you do it',
    'Quote <local-command-caveat>this markup</local-command-caveat> exactly.',
  ])
})

test('keeps local command output out of the prompt path', async () => {
  const file = await fixtureFile('harnessNoise')
  const commandOutput = file.records.find(
    (record) => record.kind === 'command-output' && record.uuid === 'u-stdout',
  )
  assert.equal(commandOutput?.text, 'Set effort level to medium')
  assert.equal(file.openingPrompt, '/effort')
})

test('reads harness delegation and related Shell updates without protocol markup', async () => {
  const file = await fixtureFile('harnessNoise')
  assert.deepEqual(
    file.records.filter((record) => record.kind === 'delegation'),
    [
      {
        kind: 'delegation',
        uuid: 'u-delegation',
        timestamp: '2026-07-20T16:00:08.000Z',
        actor: 'agent',
        action: 'Review the Feed card for keyboard access.',
        status: 'running',
        progress: 'Checking focus and motion',
        groupId: 'feed-review',
        callId: null,
      },
      ...[
        ['u-shell-start', '2026-07-20T16:00:09.000Z', 'Started bun run build', 'running'],
        ['u-shell-end', '2026-07-20T16:00:10.000Z', 'Build completed', 'completed'],
      ].map(([uuid, timestamp, action, status]) => ({
        kind: 'delegation',
        uuid,
        timestamp,
        actor: 'shell',
        action,
        status,
        progress: null,
        groupId: 'build',
        callId: null,
      })),
    ],
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

test('reads a pull-request link, a compaction and an interrupt', () => {
  const link = '{"type":"pr-link","prNumber":7,"prUrl":"https://h/pull/7","prRepository":"o/r"}'
  assert.deepEqual(parseTranscriptLine(link), {
    kind: 'pull-request',
    number: 7,
    url: 'https://h/pull/7',
    repository: 'o/r',
  })
  assert.equal(parseTranscriptLine('{"type":"pr-link","prNumber":"7","prUrl":"u"}'), null)
  const boundary = '{"type":"system","subtype":"compact_boundary","uuid":"c-1","parentUuid":null}'
  assert.deepEqual(parseTranscriptLine(boundary), { kind: 'compaction', uuid: 'c-1' })
  const stop =
    '{"type":"user","uuid":"u-1","message":{"role":"user","content":[{"type":"text","text":"[Request interrupted by user]"}]}}'
  assert.deepEqual(parseTranscriptLine(stop).blocks, [{ shape: 'marker', marker: 'interrupted' }])
})

test('refuses a message record with no identity', () => {
  const line = '{"type":"user","message":{"role":"user","content":"no uuid"}}'
  assert.deepEqual(parseTranscriptLine(line), { kind: 'unreadable', line })
})
