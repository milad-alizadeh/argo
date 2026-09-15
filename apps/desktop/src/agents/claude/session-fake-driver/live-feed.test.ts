import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { LiveMessage } from '../drive/live-messages'
import { feedOf, type Row, records, said, transcript } from './live-feed-transcript'

test('shows the reply a Claude Turn is drawing, and its growth, before the transcript holds it', async (context) => {
  const { root, append } = await transcript(context)
  await append(records.prompt('prompt-1', 'Write about ducks.'))
  let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.\n' }]
  const read = feedOf(() => live, root)

  const first = await read()
  assert.deepEqual(said(first.rows), [
    { id: 'prompt-1:0', role: 'user', text: 'Write about ducks.' },
    { id: 'display:ducks', role: 'assistant', text: 'Ducks glide.\n' },
  ])
  assert.equal((await read(first.revision)).type, 'session.feed.unchanged')

  live = [{ id: 'ducks', text: 'Ducks glide.\nThey dabble.\n' }]
  const grown = await read(first.revision)
  assert.equal(grown.type, 'session.feed.read')
  assert.equal(said(grown.rows).at(-1)?.text, 'Ducks glide.\nThey dabble.\n')
})

test('replaces each draft with its transcript row, once and under the same id, across a tool call', async (context) => {
  const { root, append } = await transcript(context)
  await append(records.prompt('prompt-1', 'Write about ducks, read a, then geese.'))
  let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.\nLet me read a.' }]
  const read = feedOf(() => live, root)
  const before = said((await read()).rows)

  await append(records.text('text-1', 'Ducks glide.\nLet me read a.'), records.read('read-1'))
  await append(records.result('result-1'))
  live = [...live, { id: 'geese', text: 'Geese honk.\n' }]
  const between = await read()

  await append(records.text('text-2', 'Geese honk.\nThey fly south.'))
  live = [live[0] as LiveMessage, { id: 'geese', text: 'Geese honk.\nThey fly south.' }]
  const landed = await read()

  const ducks = { id: 'display:ducks', role: 'assistant', text: 'Ducks glide.\nLet me read a.' }
  const geese = { id: 'display:geese', role: 'assistant', text: 'Geese honk.\n' }
  assert.deepEqual(before.slice(1), [ducks])
  assert.deepEqual(said(between.rows).slice(1), [ducks, geese])
  assert.deepEqual(
    between.rows?.map((row) => row.id),
    ['prompt-1:0', 'display:ducks', 'tool-group:db59a7811ed4e4d5', 'display:geese'],
  )
  assert.deepEqual(said(landed.rows).slice(1), [
    ducks,
    { ...geese, text: 'Geese honk.\nThey fly south.' },
  ])
})

test('shows each draft once when the Turn’s transcript holds text the hook never drew', async (context) => {
  const cases = [
    {
      name: 'a user text record inside the Turn',
      between: records.prompt('skill-1', 'The skill body Claude injected.'),
    },
    {
      name: 'an assistant reply with no MessageDisplay batch',
      between: records.text('synthetic-1', 'API Error: overloaded.'),
    },
  ]
  for (const { name, between } of cases) {
    const { root, append } = await transcript(context)
    await append(records.prompt('prompt-1', 'Write about ducks, then geese.'))
    let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.' }]
    const read = feedOf(() => live, root)
    await append(records.text('text-1', 'Ducks glide.'))
    await read()
    await append(between)
    live = [...live, { id: 'geese', text: 'Geese honk.' }]
    const streaming = await read()
    await append(records.text('text-2', 'Geese honk. They fly.'))
    const landed = await read()

    const expected = ['prompt-1:0', 'display:ducks', `${between.uuid}:0`, 'display:geese']
    const ids = (rows: Row[] | undefined) => (rows ?? []).map((row) => row.id)
    assert.deepEqual(ids(streaming.rows), expected, name)
    assert.deepEqual(ids(landed.rows), expected, name)
    assert.equal(said(landed.rows).at(-1)?.text, 'Geese honk. They fly.', name)
  }
})

test('keeps a streamed row’s id after Argo sends the next Turn, and matches from the new prompt', async (context) => {
  const { root, append } = await transcript(context)
  await append(records.prompt('prompt-1', 'Write about ducks.'))
  let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.' }]
  const read = feedOf(() => live, root)
  await read()
  await append(records.text('text-1', 'Ducks glide.'))
  await read()

  live = [{ id: 'geese', text: 'Geese honk.\n' }]
  await append(records.prompt('prompt-2', 'Now geese.'))
  const next = await read()

  assert.deepEqual(said(next.rows), [
    { id: 'prompt-1:0', role: 'user', text: 'Write about ducks.' },
    { id: 'display:ducks', role: 'assistant', text: 'Ducks glide.' },
    { id: 'prompt-2:0', role: 'user', text: 'Now geese.' },
    { id: 'display:geese', role: 'assistant', text: 'Geese honk.\n' },
  ])
})
