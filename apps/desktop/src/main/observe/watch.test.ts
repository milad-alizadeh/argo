import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHANGE_DEBOUNCE_MS, type Watcher, watchTranscripts } from './watch'

// The one test that touches a real OS watch, because the whole incremental claim rests on it.
const SETTLE_MS = CHANGE_DEBOUNCE_MS + 2_000

let root: string
let watcher: Watcher | null = null

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const settle = async (until: () => boolean): Promise<void> => {
  const deadline = Date.now() + SETTLE_MS
  while (Date.now() < deadline && !until()) {
    await sleep(50)
  }
}

/**
 * Wait until the watch is actually delivering, then hand back a clean slate.
 *
 * `fs.watch` with `recursive: true` is FSEvents on macOS, and FSEvents arms ASYNCHRONOUSLY —
 * `watch()` returns before the OS is delivering. A write issued in that window is not late, it
 * is MISSED: no event is queued, and since a test writes its burst once, no later event ever
 * arrives to make up for it. Waiting longer cannot fix that, which is why this was flaky rather
 * than slow. So poke a sentinel until one comes back, let its debounce drain, and only then let
 * the caller write what it is actually asserting on.
 *
 * Nothing here is a workaround for a product defect: main runs a full launch sweep before the
 * watch (ADR-0008), so an event lost to arming is re-read by the sweep rather than dropped.
 */
const armed = async (seen: string[]): Promise<void> => {
  const probe = join(root, 'armed.jsonl')
  const deadline = Date.now() + SETTLE_MS
  while (Date.now() < deadline && !seen.includes(probe)) {
    writeFileSync(probe, '{}\n', { flag: 'a' })
    // Longer than the debounce, deliberately. Poking faster than CHANGE_DEBOUNCE_MS would reset
    // the timer on every poke and the callback would never fire at all — the sentinel has to go
    // quiet long enough for the thing it is testing to report.
    await sleep(CHANGE_DEBOUNCE_MS + 150)
  }
  if (!seen.includes(probe)) throw new Error('the OS watch never armed — cannot test it')
  seen.length = 0
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'argo-watch-'))
})

afterEach(() => {
  watcher?.close()
  watcher = null
  rmSync(root, { recursive: true, force: true })
})

describe('watchTranscripts', () => {
  it('names the .jsonl that changed, coalescing a burst of appends into one call', async () => {
    const changed: string[] = []
    // The project dir exists BEFORE the watch: a directory created afterwards is a second thing
    // for the recursive watch to pick up, and this test is about appends, not about that.
    mkdirSync(join(root, 'project-a'))
    watcher = watchTranscripts(root, (path) => changed.push(path))
    await armed(changed)
    const path = join(root, 'project-a', 'live.jsonl')

    for (const line of ['{"a":1}', '{"a":2}', '{"a":3}']) {
      writeFileSync(path, `${line}\n`, { flag: 'a' })
    }
    await settle(() => changed.length > 0)
    // Three appends, one call — the coalescing claim. Read after the debounce has had a further
    // window to fire again, so a second call would be caught rather than raced past.
    await sleep(CHANGE_DEBOUNCE_MS * 2)

    expect(changed).toEqual([path])
  })

  it('ignores everything that is not a transcript', async () => {
    const changed: string[] = []
    watcher = watchTranscripts(root, (path) => changed.push(path))
    await armed(changed)
    writeFileSync(join(root, 'notes.md'), 'hello')
    writeFileSync(join(root, 'live.jsonl'), '{}\n')

    await settle(() => changed.length > 0)
    await sleep(CHANGE_DEBOUNCE_MS * 2)

    expect(changed).toEqual([join(root, 'live.jsonl')])
  })

  it('is a no-op watcher when the root does not exist', () => {
    const missing = watchTranscripts(join(root, 'nope'), () => {
      throw new Error('must not fire')
    })

    expect(() => missing.close()).not.toThrow()
  })
})
