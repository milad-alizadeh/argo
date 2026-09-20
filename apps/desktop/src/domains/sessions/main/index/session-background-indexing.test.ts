import { describe, expect, test } from 'vitest'
import {
  createLaunchBackfillTick,
  reconcileIndexedSources,
} from '@/domains/sessions/main/index/session-background-indexing'

describe('reconcileIndexedSources', () => {
  test('leaves a fresh index to bounded backfill instead of reconciling its full history', async () => {
    await expect(
      reconcileIndexedSources([
        {
          historyComplete: async () => false,
          reconcileAll: async () => {
            throw new Error('full reconcile')
          },
        },
      ]),
    ).resolves.toBeUndefined()
  })

  test('reconciles an established index after startup', async () => {
    await expect(
      reconcileIndexedSources([
        {
          historyComplete: async () => true,
          reconcileAll: async () => {
            throw new Error('full reconcile')
          },
        },
      ]),
    ).rejects.toThrow('full reconcile')
  })
})

describe('createLaunchBackfillTick', () => {
  test('starts a bounded backfill before reconciling the full history', async () => {
    const progress = [
      { boundary: { writtenAt: 2, path: '/recent.jsonl' }, complete: false },
      { boundary: { writtenAt: 1, path: '/older.jsonl' }, complete: true },
    ]
    const tick = createLaunchBackfillTick({
      backfillTick: async () => progress.shift() ?? { boundary: null, complete: true },
      reconcileAll: async () => {
        throw new Error('full reconcile')
      },
    })

    await expect(tick()).resolves.toEqual({
      boundary: { writtenAt: 2, path: '/recent.jsonl' },
      complete: false,
    })
    await expect(tick()).rejects.toThrow('full reconcile')
  })
})
