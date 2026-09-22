import { describe, expect, test } from 'vitest'
import { unusedIndex } from '@/harnesses/composition/harness-registration.fixture'
import { createBackgroundIndexing } from './background-indexing'

function enoent(): NodeJS.ErrnoException {
  const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException
  error.code = 'ENOENT'
  return error
}

describe('createBackgroundIndexing', () => {
  test('treats a Harness root with no history yet as nothing to backfill (#2607)', async () => {
    const background = createBackgroundIndexing(
      {
        harness: 'claude',
        identities: async () => {
          throw enoent()
        },
        readTranscripts: async () => ({ files: [], unreadablePaths: [] }),
        stitch: () => [],
        project: () => {
          throw new Error('not exercised')
        },
        history: { knownIds: new Set(), parents: new Map() },
      },
      () => ({
        readWindow: async () => {
          throw new Error('not exercised')
        },
        ensureHydrated: async () => undefined,
        pass: undefined as never,
      }),
    )

    const index = {
      ...unusedIndex,
      backfillProgress: async () => ({ boundary: null, complete: false }),
    }

    await expect(background.backfillTick('/missing/root', index, 10)).resolves.toEqual({
      boundary: null,
      complete: true,
    })
    await expect(background.reconcileAll('/missing/root', index)).resolves.toEqual({
      filesParsed: 0,
    })
  })
})
