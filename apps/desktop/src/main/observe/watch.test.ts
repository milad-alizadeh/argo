import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHANGE_DEBOUNCE_MS, type Watcher, watchTranscripts } from './watch'

// The one test that touches a real OS watch, because the whole incremental claim rests on it.
const SETTLE_MS = CHANGE_DEBOUNCE_MS + 2_000

let root: string
let watcher: Watcher | null = null

const settle = async (until: () => boolean): Promise<void> => {
  const deadline = Date.now() + SETTLE_MS
  while (Date.now() < deadline && !until()) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
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
    watcher = watchTranscripts(root, (path) => changed.push(path))
    mkdirSync(join(root, 'project-a'))
    const path = join(root, 'project-a', 'live.jsonl')

    for (const line of ['{"a":1}', '{"a":2}', '{"a":3}']) {
      writeFileSync(path, `${line}\n`, { flag: 'a' })
    }
    await settle(() => changed.length > 0)

    expect(changed).toEqual([path])
  })

  it('ignores everything that is not a transcript', async () => {
    const changed: string[] = []
    watcher = watchTranscripts(root, (path) => changed.push(path))
    writeFileSync(join(root, 'notes.md'), 'hello')
    writeFileSync(join(root, 'live.jsonl'), '{}\n')

    await settle(() => changed.length > 0)

    expect(changed).toEqual([join(root, 'live.jsonl')])
  })

  it('is a no-op watcher when the root does not exist', () => {
    const missing = watchTranscripts(join(root, 'nope'), () => {
      throw new Error('must not fire')
    })

    expect(() => missing.close()).not.toThrow()
  })
})
