// The pure arithmetic behind backfilling older history in bounded batches (#2373): which files the
// next batch covers, and when there is nothing older left. `runBackfillBatch`, which also reindexes
// what the batch finds changed, is `backfill-window.vitest.ts` because it needs the real index.
import { describe, expect, test } from 'vitest'
import { nextBackfillSlice } from '@/domains/sessions/main/session-index/backfill-pass'
import type { TranscriptFileIdentity } from '@/domains/sessions/main/session-index/contract'

function identityAt(
  minutesAgo: number,
  path = `/transcripts/${minutesAgo}.jsonl`,
): TranscriptFileIdentity {
  return { path, name: `${minutesAgo}.jsonl`, writtenAt: 1_000_000 - minutesAgo * 60_000, size: 10 }
}

// Newest first, the order every listing already comes in.
const TEN_FILES = Array.from({ length: 10 }, (_, index) => identityAt(index))

function fileAt(index: number): TranscriptFileIdentity {
  const file = TEN_FILES[index]
  if (file === undefined) throw new Error(`No fixture file at index ${index}.`)
  return file
}

function boundaryAt(file: TranscriptFileIdentity) {
  return { writtenAt: file.writtenAt, path: file.path }
}

function pathsOf(files: readonly TranscriptFileIdentity[]) {
  return files.map((file) => file.path)
}

describe('nextBackfillSlice', () => {
  test('starts at the newest file when nothing has been backfilled yet', () => {
    const { batch, complete } = nextBackfillSlice(TEN_FILES, null, 4)

    expect(pathsOf(batch)).toEqual(pathsOf(TEN_FILES.slice(0, 4)))
    expect(complete).toBe(false)
  })

  test('continues past the boundary the last batch left, without repeating it', () => {
    const boundary = boundaryAt(fileAt(3))

    const { batch, complete } = nextBackfillSlice(TEN_FILES, boundary, 4)

    expect(pathsOf(batch)).toEqual(pathsOf(TEN_FILES.slice(4, 8)))
    expect(complete).toBe(false)
  })

  test('reports complete once the batch reaches the oldest file', () => {
    const boundary = boundaryAt(fileAt(7))

    const { batch, complete } = nextBackfillSlice(TEN_FILES, boundary, 4)

    expect(pathsOf(batch)).toEqual(pathsOf(TEN_FILES.slice(8, 10)))
    expect(complete).toBe(true)
  })

  test('stays complete, with an empty batch, once the boundary is already the oldest file', () => {
    const boundary = boundaryAt(fileAt(9))

    const { batch, complete } = nextBackfillSlice(TEN_FILES, boundary, 4)

    expect(batch).toEqual([])
    expect(complete).toBe(true)
  })

  test('breaks a tied written time by path, so two files sharing a mtime are never both skipped', () => {
    const a = identityAt(0, '/transcripts/a.jsonl')
    const tied = [a, identityAt(0, '/transcripts/b.jsonl')]
    const boundary = { writtenAt: a.writtenAt, path: '/transcripts/a.jsonl' }

    const { batch, complete } = nextBackfillSlice(tied, boundary, 4)

    expect(pathsOf(batch)).toEqual(['/transcripts/b.jsonl'])
    expect(complete).toBe(true)
  })

  test('finds the cut point even when the boundary file itself is gone from the listing', () => {
    const withoutOne = [fileAt(0), fileAt(1), fileAt(3), fileAt(4)]
    const boundary = boundaryAt(fileAt(2))

    const { batch } = nextBackfillSlice(withoutOne, boundary, 4)

    expect(pathsOf(batch)).toEqual([fileAt(3).path, fileAt(4).path])
  })

  test('never loses or repeats a file across batches that new arrivals at the head shift', () => {
    // Backfill has covered the first four; two new Sessions land at the front. The boundary still
    // names the fourth-oldest file's own identity, so what comes after it does not move.
    const boundary = boundaryAt(fileAt(3))
    const withNewArrivals = [identityAt(-2), identityAt(-1), ...TEN_FILES]

    const { batch } = nextBackfillSlice(withNewArrivals, boundary, 4)

    expect(pathsOf(batch)).toEqual(pathsOf(TEN_FILES.slice(4, 8)))
  })
})
