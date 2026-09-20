import { expect, test } from 'bun:test'
import { parseReadyRecord, processIsRunning, type ReadyRecord } from './dev-control.mts'

const readyRecord: ReadyRecord = {
  id: 'ticket-2173-a1b2c3d4',
  label: '#2173',
  launcherPid: 42,
  port: 45173,
  debugPort: 45174,
  processId: 43,
  state: 'ready',
  title: 'Argo dev · #2173 · :45173',
  userData: '/tmp/argo-desktop-dev/ticket-2173/user-data',
  version: 1,
  windowId: 17,
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

test('checks the recorded Electron process before controlling it', () => {
  expect(
    processIsRunning(43, (processId, signal) => {
      expect(processId).toBe(43)
      expect(signal).toBe(0)
    }),
  ).toBe(true)
})
