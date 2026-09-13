import assert from 'node:assert/strict'
import { test } from 'node:test'

import { claudeTurn } from '../drive/claude-turn.ts'

test('sends one normalized prompt as a bracketed paste followed by Return', () => {
  assert.deepEqual(claudeTurn('Review\r\nthe Session shell.'), {
    paste: '\u001b[200~Review\nthe Session shell.\u001b[201~',
    submit: '\r',
  })
})

test('removes nested bracketed-paste terminators before a prompt reaches the terminal', () => {
  assert.deepEqual(claudeTurn('\u001b[20\u001b[200~0~inspect\u001b[201~'), {
    paste: '\u001b[200~inspect\u001b[201~',
    submit: '\r',
  })
})
