import { expect, test } from 'vitest'
import { closeSessionResources } from './session-shutdown'

test('waits for recovery and adapter cleanup before closing SQLite', async () => {
  const steps: string[] = []
  let finishRecovery: () => void = () => {}
  const recovery = new Promise<void>((resolve) => {
    finishRecovery = resolve
  })
  let finishAdapters: () => void = () => {}
  const adapters = new Promise<void>((resolve) => {
    finishAdapters = resolve
  })
  let adaptersStarted: () => void = () => {}
  const started = new Promise<void>((resolve) => {
    adaptersStarted = resolve
  })
  const closing = closeSessionResources({
    stopNewWork: () => steps.push('stop'),
    waitForRecovery: () => recovery,
    closeAdapters: async () => {
      steps.push('adapters')
      adaptersStarted()
      await adapters
    },
    closeStores: () => {
      steps.push('database')
    },
  })
  expect(steps).toEqual(['stop'])
  finishRecovery()
  await started
  expect(steps).toEqual(['stop', 'adapters'])
  finishAdapters()
  await closing
  expect(steps).toEqual(['stop', 'adapters', 'database'])
})
