import { expect, test } from 'bun:test'
import { parseReadyRecord, processIsRunning, stopRecordedElectron } from './dev-control.mjs'

const readyRecord = {
  id: 'ticket-2173-a1b2c3d4',
  launcherPid: 42,
  port: 45173,
  processId: 43,
  state: 'ready',
  title: 'Argo dev · ticket-2173 · :45173',
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

test('stops and awaits the recorded Electron process instead of only Forge', async () => {
  let running = true
  const signals = []

  await stopRecordedElectron(readyRecord, {
    kill: (processId, signal) => {
      expect(processId).toBe(readyRecord.processId)
      signals.push(signal)
      if (signal === 'SIGTERM') running = false
      else if (!running) {
        const error = new Error('gone')
        error.code = 'ESRCH'
        throw error
      }
    },
    waitFor: async () => {},
  })

  expect(signals).toEqual([0, 'SIGTERM', 0])
})

test('does not signal a stale recorded process', async () => {
  const signals = []
  await stopRecordedElectron(readyRecord, {
    kill: (_processId, signal) => {
      signals.push(signal)
      const error = new Error('gone')
      error.code = 'ESRCH'
      throw error
    },
  })
  expect(signals).toEqual([0])
})
