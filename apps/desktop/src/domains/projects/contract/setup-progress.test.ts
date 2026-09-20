import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseSetupApplicationProgressEvent,
  parseSetupPlanningProgressEvent,
} from './setup-progress'

test('parses a running planning progress event', () => {
  const event = parseSetupPlanningProgressEvent({
    revision: 'plan-1',
    stepId: 'identify-targets',
    status: 'running',
    message: 'Scanning workspace packages',
  })
  assert.equal(event.status, 'running')
})

test('parses a failed application progress event', () => {
  const event = parseSetupApplicationProgressEvent({
    revision: 'plan-1',
    stepId: 'verify-desktop-test',
    status: 'failed',
    message: 'bun test exited 1',
  })
  assert.equal(event.status, 'failed')
})

test('rejects an unknown status value', () => {
  assert.throws(() =>
    parseSetupPlanningProgressEvent({
      revision: 'plan-1',
      stepId: 'identify-targets',
      status: 'done',
      message: 'x',
    }),
  )
})
