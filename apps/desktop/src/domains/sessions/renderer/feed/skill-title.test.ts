import { expect, test } from 'bun:test'
import { withoutRepeatedTitle } from '@/domains/sessions/renderer/feed/skill-title'

test.each([
  ['# Simple English\n\nWrite plain English.', 'Write plain English.'],
  ['## simple-english ##\nWrite plain English.', 'Write plain English.'],
  ['# Writing rules\n\nWrite plain English.', '# Writing rules\n\nWrite plain English.'],
  ['Write plain English.\n# Simple English', 'Write plain English.\n# Simple English'],
])('a skill body %p named "Simple english" reads %p', (body, shown) => {
  expect(withoutRepeatedTitle(body, 'Simple english')).toBe(shown)
})
