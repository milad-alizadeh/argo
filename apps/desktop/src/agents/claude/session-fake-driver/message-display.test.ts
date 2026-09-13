import { expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { CompanionPart } from '../drive/companion-plugin'
import { createMessageDisplay } from '../drive/message-display'

const BATCH = {
  session_id: 'claude-session',
  hook_event_name: 'MessageDisplay',
  turn_id: 'turn-1',
  message_id: 'ducks',
  index: 0,
  final: false,
  delta: 'Ducks glide.\n',
}

// Runs the hook script the way Claude Code does: the input on stdin, whatever it prints read back.
async function runHook(part: CompanionPart) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-display-hook-'))
  const script = path.join(folder, part.hook.file)
  await writeFile(script, part.hook.script, { mode: 0o700 })
  const started = performance.now()
  const result = await new Promise<{ code: number; stdout: string }>((resolve) => {
    const child = execFile('/bin/sh', [script], (error, stdout) => {
      resolve({ code: typeof error?.code === 'number' ? error.code : 0, stdout })
    })
    child.stdin?.end(JSON.stringify(BATCH))
  })
  await rm(folder, { recursive: true, force: true })
  return { ...result, elapsedMs: performance.now() - started }
}

test('hands each MessageDisplay batch to the Session it was opened for', async () => {
  const display = createMessageDisplay()
  const received: unknown[] = []
  const opened = display.open(randomUUID(), (batch) => received.push(batch))

  const hook = await runHook(opened)

  expect(hook).toMatchObject({ code: 0, stdout: '' })
  expect(received).toEqual([BATCH])
  opened.close()
  display.close()
})

test('returns at once, leaving the terminal text alone, when Argo is not listening', async () => {
  const display = createMessageDisplay()
  const opened = display.open(randomUUID(), () => {})
  opened.close()
  display.close()

  const hook = await runHook(opened)

  expect(hook).toMatchObject({ code: 0, stdout: '' })
  expect(hook.elapsedMs).toBeLessThan(500)
})

test('keeps the display socket path inside the macOS limit', () => {
  const display = createMessageDisplay()
  const opened = display.open(randomUUID(), () => {})
  const socket = opened.hook.script.match(/nc -U -w 1 "([^"]+)"/)?.[1] ?? ''

  expect(socket).not.toBe('')
  expect(Buffer.byteLength(socket)).toBeLessThan(104)
  opened.close()
  display.close()
})
