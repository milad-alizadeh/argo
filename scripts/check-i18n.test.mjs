import assert from 'node:assert/strict'
import test from 'node:test'

import { hardCodedText } from './check-i18n.mjs'

test('reports literal reader text in a production render surface', () => {
  const source = `export function Notice() { return <button aria-label="Close">Dismiss</button> }`

  assert.deepEqual(hardCodedText(source, 'Notice.tsx'), [
    'Notice.tsx:1: literal aria-label "Close" must use i18n',
    'Notice.tsx:1: literal text "Dismiss" must use i18n',
  ])
})

test('allows translated and dynamic reader text', () => {
  const source = `export function Notice({ name }) { return <button aria-label={t('close')}>{name}</button> }`

  assert.deepEqual(hardCodedText(source, 'Notice.tsx'), [])
})

test('reports only reader text on changed lines', () => {
  const source = `<button>Existing label</button>\n<button>New label</button>`

  assert.deepEqual(hardCodedText(source, 'Notice.tsx', new Set([2])), [
    'Notice.tsx:2: literal text "New label" must use i18n',
  ])
})
