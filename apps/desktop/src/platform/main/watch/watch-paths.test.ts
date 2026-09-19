import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SETTLE_MS, watchTrees } from '@/platform/main/watch/watch-paths'

// Twice the settle window, so a change that has been reported has certainly arrived and a change that
// has not been reported certainly never will be.
const QUIET_MS = SETTLE_MS * 2
const ARMING_ATTEMPTS = 10

function quiet() {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS))
}

// A recursive `fs.watch` arms asynchronously, and a write that lands before it is armed is never
// reported: that race failed these cases 1, 0 and 2 times over three runs. Each case therefore
// writes a probe until one comes back, and only then starts counting. A probe waits out the settle
// window, because writes inside it coalesce and would keep pushing the report away.
async function armedWatch(name: string) {
  const root = await mkdtemp(path.join(tmpdir(), `argo-watch-${name}-`))
  let reported = 0
  const watched = watchTrees([root])(() => {
    reported += 1
  })
  let counted = 0
  for (let attempt = 0; attempt < ARMING_ATTEMPTS && reported === 0; attempt += 1) {
    await writeFile(path.join(root, 'arming.jsonl'), `{"attempt":${attempt}}\n`)
    await quiet()
  }
  if (reported === 0) {
    watched()
    await rm(root, { force: true, recursive: true })
    throw new Error('the watch never reported a write under its own root')
  }
  counted = reported
  return {
    root,
    changes: () => reported - counted,
    close: watched,
    discard: async () => {
      watched()
      await rm(root, { force: true, recursive: true })
    },
  }
}

describe('watching a tree', () => {
  test('reports a file written under the watched root', async () => {
    const watched = await armedWatch('written')
    try {
      await writeFile(path.join(watched.root, 'session.jsonl'), '{}\n')
      await quiet()
      expect(watched.changes()).toBe(1)
    } finally {
      await watched.discard()
    }
  })

  test('reports a burst of writes as one change', async () => {
    const watched = await armedWatch('burst')
    try {
      const file = path.join(watched.root, 'session.jsonl')
      for (let index = 0; index < 20; index += 1) await writeFile(file, `{"line":${index}}\n`)
      await quiet()
      expect(watched.changes()).toBe(1)
    } finally {
      await watched.discard()
    }
  })

  test('reports nothing after it is closed', async () => {
    const watched = await armedWatch('closed')
    try {
      watched.close()
      await writeFile(path.join(watched.root, 'session.jsonl'), '{}\n')
      await quiet()
      expect(watched.changes()).toBe(0)
    } finally {
      await watched.discard()
    }
  })

  test('watches the trees that exist when one of them does not', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'argo-watch-present-'))
    let changes = 0
    const watched = watchTrees([path.join(root, 'absent'), root])(() => {
      changes += 1
    })
    try {
      for (let attempt = 0; attempt < ARMING_ATTEMPTS && changes === 0; attempt += 1) {
        await writeFile(path.join(root, 'session.jsonl'), `{"attempt":${attempt}}\n`)
        await quiet()
      }
      expect(changes).toBeGreaterThan(0)
    } finally {
      watched()
      await rm(root, { force: true, recursive: true })
    }
  })
})
