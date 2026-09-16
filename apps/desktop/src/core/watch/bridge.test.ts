import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { registerWatching } from './bridge'
import { failableOpener } from './failable-opener'
import { WATCHED_CHANGED_CHANNEL } from './watch-contract'
import { SETTLE_MS, watchTrees } from './watch-paths'

// Twice the settle window, so a message that has been sent has certainly arrived.
const QUIET_MS = SETTLE_MS * 2
const ARMING_ATTEMPTS = 10

function quiet() {
  return new Promise((resolve) => setTimeout(resolve, QUIET_MS))
}

// A stand-in for the one thing here that cannot run for real: an Electron window. The watch itself,
// the settling and the files are all real.
function fakeWindow() {
  const sent: { channel: string; topic: unknown }[] = []
  let destroyed = false
  const closers: (() => void)[] = []
  const window = {
    isDestroyed: () => destroyed,
    webContents: {
      send: (channel: string, topic: unknown) => sent.push({ channel, topic }),
    },
    on: (event: string, listener: () => void) => {
      if (event === 'closed') closers.push(listener)
    },
  }
  return {
    close: () => {
      destroyed = true
      for (const listener of closers) listener()
    },
    sent,
    window: window as unknown as BrowserWindow,
  }
}

// A recursive watch arms asynchronously, so a write that lands before it is armed is never reported.
// Each case writes until the first message arrives and measures from there (watch-paths.test.ts).
async function armed(host: ReturnType<typeof fakeWindow>, file: string) {
  for (let attempt = 0; attempt < ARMING_ATTEMPTS && host.sent.length === 0; attempt += 1) {
    await writeFile(file, `{"attempt":${attempt}}\n`)
    await quiet()
  }
  expect(host.sent.length).toBeGreaterThan(0)
}

describe('telling a window its data changed', () => {
  test('names the topic whose tree a CLI wrote under', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'argo-bridge-wrote-'))
    const host = fakeWindow()
    try {
      registerWatching(host.window, { sessions: [watchTrees([root])] })
      await armed(host, path.join(root, 'session.jsonl'))
      expect(host.sent[0]).toEqual({ channel: WATCHED_CHANGED_CHANNEL, topic: 'sessions' })
    } finally {
      host.close()
      await rm(root, { force: true, recursive: true })
    }
  })

  test('says nothing more once the window has closed', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'argo-bridge-closed-'))
    const host = fakeWindow()
    try {
      registerWatching(host.window, { sessions: [watchTrees([root])] })
      await armed(host, path.join(root, 'session.jsonl'))
      const before = host.sent.length
      host.close()
      await writeFile(path.join(root, 'later.jsonl'), '{}\n')
      await quiet()
      expect(host.sent.length).toBe(before)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})

describe('telling a window about a watch that had to be opened again', () => {
  test('carries a change announced after a dead watch reopened', async () => {
    const host = fakeWindow()
    const opener = failableOpener()
    try {
      registerWatching(host.window, { sessions: [watchTrees(['/transcripts'], opener.open)] })
      opener.fail()
      await quiet()
      // Reopening is itself a change, because whatever the tree did while it was blind went unsaid.
      expect(host.sent).toEqual([{ channel: WATCHED_CHANGED_CHANNEL, topic: 'sessions' }])
      opener.emit()
      await quiet()
      expect(host.sent.length).toBe(2)
    } finally {
      host.close()
    }
  })

  test('carries a change under a root that only appeared after it was registered', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'argo-bridge-late-'))
    const root = path.join(parent, 'transcripts')
    const host = fakeWindow()
    try {
      registerWatching(host.window, { sessions: [watchTrees([root])] })
      await mkdir(root)
      await quiet()
      await armed(host, path.join(root, 'session.jsonl'))
      expect(host.sent[0]).toEqual({ channel: WATCHED_CHANGED_CHANNEL, topic: 'sessions' })
    } finally {
      host.close()
      await rm(parent, { force: true, recursive: true })
    }
  })
})

describe('telling a window about a source that is not a tree', () => {
  test('names the topic for a source that watches no tree at all', () => {
    const host = fakeWindow()
    let announce: () => void = () => {}
    let closed = false
    registerWatching(host.window, {
      sessions: [
        (onChanged) => {
          announce = onChanged
          return { close: () => (closed = true) }
        },
      ],
    })
    announce()
    expect(host.sent).toEqual([{ channel: WATCHED_CHANGED_CHANNEL, topic: 'sessions' }])
    host.close()
    expect(closed).toBe(true)
  })
})
