import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { registerWatching } from './bridge'
import { WATCHED_CHANGED_CHANNEL } from './watch-contract'
import { SETTLE_MS } from './watch-paths'

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
      registerWatching(host.window, { sessions: [root] })
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
      registerWatching(host.window, { sessions: [root] })
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
