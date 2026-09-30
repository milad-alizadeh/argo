import { expect, test } from 'bun:test'
import { statusVariantOf } from './session-row-status'

test('keeps a new Session idle until its first Turn is working', () => {
  expect(statusVariantOf({ status: 'starting' })).toBe('idle')
  expect(statusVariantOf({ status: 'running' })).toBe('active')
})
