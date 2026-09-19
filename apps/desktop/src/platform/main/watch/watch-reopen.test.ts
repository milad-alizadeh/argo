import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { failableOpener } from '@/platform/main/watch/failable-opener'
import { REOPEN_DELAYS_MS, SETTLE_MS, watchTrees } from '@/platform/main/watch/watch-paths'

// Twice the settle window, so a change that has been announced has certainly arrived.
const QUIET_MS = SETTLE_MS * 2
const ARMING_ATTEMPTS = 10

function quiet(extra = 0) {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS + extra))
}

describe('a watch that died', () => {
  test('opens the root again, and reports what it then sees', async () => {
    const opener = failableOpener()
    let changes = 0
    const watched = watchTrees(
      ['/transcripts'],
      opener.open,
    )(() => {
      changes += 1
    })
    try {
      opener.fail()
      await quiet(REOPEN_DELAYS_MS[0])
      expect(opener.opens).toBe(2)
      // Opening again is itself a change: whatever was written while the watch was dead was never
      // reported, so the reader has to read once on its own account.
      expect(changes).toBe(1)
      opener.emit()
      await quiet()
      expect(changes).toBe(2)
    } finally {
      watched()
    }
  })

  // A watch that dies the moment it opens is the case the backoff exists for. Each reopen announces,
  // and an announcement costs a full discovery pass, so a flap that never backs off would read the
  // trees harder than the poll #2303 removed.
  test('backs off a root that dies as soon as it is opened', async () => {
    const opener = failableOpener()
    const watched = watchTrees(['/transcripts'], opener.open)(() => {})
    try {
      const deadline = Date.now() + REOPEN_DELAYS_MS[0] + REOPEN_DELAYS_MS[1] + QUIET_MS
      while (Date.now() < deadline) {
        opener.fail()
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      // Without a backoff the first delay would repeat, giving one open every 50ms.
      expect(opener.opens).toBeLessThan(5)
    } finally {
      watched()
    }
  })

  test('stops opening the root again once the caller has closed', async () => {
    const opener = failableOpener()
    const watched = watchTrees(['/transcripts'], opener.open)(() => {})
    opener.fail()
    watched()
    await quiet(REOPEN_DELAYS_MS[0])
    expect(opener.opens).toBe(1)
  })
})

describe('a root that is not there yet', () => {
  test('is watched once it appears', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'argo-watch-late-'))
    const root = path.join(parent, 'transcripts')
    let changes = 0
    const watched = watchTrees([root])(() => {
      changes += 1
    })
    try {
      await mkdir(root)
      // The open that finds the root announces by itself, because whatever happened to the tree
      // while there was no watch on it was never reported.
      await quiet(REOPEN_DELAYS_MS[0])
      expect(changes).toBeGreaterThan(0)
      const announced = changes
      for (let attempt = 0; attempt < ARMING_ATTEMPTS && changes === announced; attempt += 1) {
        await writeFile(path.join(root, 'session.jsonl'), `{"attempt":${attempt}}\n`)
        await quiet()
      }
      expect(changes).toBeGreaterThan(announced)
    } finally {
      watched()
      await rm(parent, { force: true, recursive: true })
    }
  })
})
