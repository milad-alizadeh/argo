import { expect, test } from 'bun:test'
import { statusVariantOf } from './session-roster-status'

test('keeps a new Session idle until its first Turn is working', () => {
  expect(statusVariantOf({ status: 'starting', unread: false })).toBe('idle')
  expect(statusVariantOf({ status: 'running', unread: false })).toBe('active')
})

test('keeps an unread result hidden while its next Turn is working', () => {
  expect(statusVariantOf({ status: 'running', unread: true })).toBe('active')
  expect(statusVariantOf({ status: 'idle', unread: true })).toBe('unread')
})
