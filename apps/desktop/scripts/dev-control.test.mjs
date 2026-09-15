import { expect, test } from 'bun:test'
import { parseReadyRecord } from './dev-control.mjs'

const readyRecord = {
  id: 'ticket-2173-a1b2c3d4',
  launcherPid: 42,
  port: 45173,
  processId: 43,
  state: 'ready',
  title: 'Argo dev · ticket-2173 · :45173',
  userData: '/tmp/argo-desktop-dev/ticket-2173/user-data',
  version: 1,
  worktree: '/worktrees/ticket-2173',
}

test('parses the ready record before it controls a process', () => {
  expect(parseReadyRecord(readyRecord)).toEqual(readyRecord)
})

test('rejects a ready record with an unsafe process identifier', () => {
  expect(() => parseReadyRecord({ ...readyRecord, processId: 0 })).toThrow(
    'Ready record has invalid processId.',
  )
})
