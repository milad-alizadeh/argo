import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fed, feedRequest, rowsOf } from '../../../domains/sessions/main/reader-test-helpers'
import { readerOverRollout } from './rollout-reader-test-helper'

const SESSION = 'parityLookup'

test('reads a viewed image as a file read whose result is the embedded image', async (context) => {
  const reader = await readerOverRollout(context, {
    fixture: `rollout-${SESSION}.jsonl`,
    session: SESSION,
  })
  const rows = rowsOf(await fed(reader, feedRequest(SESSION)))
  const images = rows.filter((row) => row.shape === 'image')
  const read = rows.flatMap((row) =>
    row.shape === 'tool-group' ? row.calls.filter(({ kind }) => kind === 'read') : [],
  )
  assert.equal(read.length, 1)
  assert.equal(read[0]?.label, 'Read shot.png')
  assert.ok(
    images.length > 0 || JSON.stringify(rows).includes('data:image/png;base64,iVBORw0KGgo='),
    'the embedded bytes reach the Feed',
  )
})
