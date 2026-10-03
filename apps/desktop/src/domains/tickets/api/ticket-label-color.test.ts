import assert from 'node:assert/strict'
import { test } from 'node:test'
import { labelColor, ticket } from './ticket'

test('provider label colors normalize six hex digits and accept absent or null colors', () => {
  for (const [raw, expected] of [
    ['000000', '000000'],
    ['FFFFFF', 'FFFFFF'],
    ['#a2eeef', 'a2eeef'],
    ['#ABCDEF', 'ABCDEF'],
    [null, null],
    [undefined, null],
  ] as const) {
    assert.equal(labelColor(raw), expected)
  }
})

test('unsupported color values never pass through as CSS content', () => {
  for (const raw of [
    '',
    'fff',
    '#12345',
    '1234567',
    'gg0000',
    '##123456',
    'red',
    'var(--foreground)',
    123456,
    {},
    [],
  ]) {
    assert.equal(labelColor(raw), null)
  }
})

test('the normalized Ticket label contract requires a name and six digits or explicit null', () => {
  const labels = ticket.shape.labels
  assert.deepEqual(
    labels.parse([
      { name: 'black', color: '000000' },
      { name: 'uncolored', color: null },
    ]),
    [
      { name: 'black', color: '000000' },
      { name: 'uncolored', color: null },
    ],
  )
  for (const label of [
    { name: 'missing' },
    { name: 'prefixed', color: '#ffffff' },
    { name: 'short', color: 'fff' },
    { name: 7, color: null },
  ]) {
    assert.equal(labels.safeParse([label]).success, false)
  }
})
