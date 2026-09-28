import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange, HistoryFiles } from '@/harnesses/registration'
import { latestTurn, tailSessionHistory, watchHistoryActivity } from './history-watch'

async function directory(context: TestContext) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-history-tail-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  return folder
}

function files(root: string, opened: (readonly string[])[] = []): HistoryFiles {
  return {
    directory: root,
    ownerOf: (relativePath) =>
      relativePath.endsWith('.jsonl') ? path.basename(relativePath, '.jsonl') : null,
    openReader: (existing) => {
      opened.push(existing)
      return (lines) => ({
        type: 'appended',
        events: lines.map(
          (line): SessionLiveEventBody => ({
            type: 'content',
            commandId: null,
            turnId: null,
            vendorEventId: null,
            content: { kind: 'message', id: line, role: 'assistant', text: line },
          }),
        ),
      })
    },
    turnOf: (line) => {
      if (line.startsWith('prompt')) return 'open'
      return line.startsWith('answer') ? 'closed' : null
    },
  }
}

async function eventually<T>(read: () => T | undefined, timeoutMs = 3_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = read()
    if (value !== undefined) return value
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('The history watcher reported nothing in time.')
}

function appendedTexts(changes: HistoryChange[]) {
  return changes.flatMap((change) =>
    change.type === 'appended'
      ? change.events.flatMap((event) =>
          event.type === 'content' && event.content.kind === 'message' ? [event.content.text] : [],
        )
      : [],
  )
}

function tail(context: TestContext, root: string, owner: string) {
  const changes: HistoryChange[] = []
  const stop = tailSessionHistory(files(root), owner, (change) => changes.push(change))
  context.after(stop)
  return changes
}

test('opens its reader with the complete lines already in the file', async (context) => {
  const root = await directory(context)
  const file = path.join(root, 'native-1.jsonl')
  writeFileSync(file, 'first\nsecond\npart')
  const opened: (readonly string[])[] = []
  context.after(tailSessionHistory(files(root, opened), 'native-1', () => {}))

  assert.deepEqual(opened, [['first', 'second']])
})

test('streams only the complete lines appended after the tail started', async (context) => {
  const root = await directory(context)
  mkdirSync(path.join(root, 'project'))
  const file = path.join(root, 'project', 'native-1.jsonl')
  writeFileSync(file, 'before\n')
  const changes = tail(context, root, 'native-1')

  appendFileSync(file, 'first\nsecond\npart')
  await eventually(() => (appendedTexts(changes).length === 2 ? true : undefined))
  appendFileSync(file, 'ial\n')
  await eventually(() => (appendedTexts(changes).length === 3 ? true : undefined))

  assert.deepEqual(appendedTexts(changes), ['first', 'second', 'partial'])
  assert.equal(
    changes.some((change) => change.type === 'rewritten'),
    false,
  )
})

test('ignores another Session file in the same directory', async (context) => {
  const root = await directory(context)
  writeFileSync(path.join(root, 'native-1.jsonl'), '')
  const changes = tail(context, root, 'native-1')

  appendFileSync(path.join(root, 'native-2.jsonl'), 'other\n')
  appendFileSync(path.join(root, 'native-1.jsonl'), 'mine\n')
  await eventually(() => (appendedTexts(changes).length > 0 ? true : undefined))

  assert.deepEqual(appendedTexts(changes), ['mine'])
})

test('streams a file that appears after the tail started from its first line', async (context) => {
  const root = await directory(context)
  const changes = tail(context, root, 'native-1')

  writeFileSync(path.join(root, 'native-1.jsonl'), 'created\n')
  await eventually(() => (appendedTexts(changes).length > 0 ? true : undefined))

  assert.deepEqual(appendedTexts(changes), ['created'])
})

test('reports a truncated file as rewritten', async (context) => {
  const root = await directory(context)
  const file = path.join(root, 'native-1.jsonl')
  writeFileSync(file, 'first line\nsecond line\n')
  const changes = tail(context, root, 'native-1')

  writeFileSync(file, 'short\n')
  await eventually(() => changes.find((change) => change.type === 'rewritten'))

  assert.deepEqual(appendedTexts(changes), [])
})

test('reports a file rewritten in place to a longer length as rewritten', async (context) => {
  const root = await directory(context)
  const file = path.join(root, 'native-1.jsonl')
  writeFileSync(file, '{"text":"old"}\n')
  const changes = tail(context, root, 'native-1')

  writeFileSync(file, '{"text":"a much longer replacement"}\n')
  await eventually(() => changes.find((change) => change.type === 'rewritten'))

  assert.deepEqual(appendedTexts(changes), [])
})

test('reports activity on any Session file with its owner and newest turn', async (context) => {
  const root = await directory(context)
  mkdirSync(path.join(root, 'project'))
  const activity: [string, string | null][] = []
  const stop = watchHistoryActivity(files(root), (owner, turn) => activity.push([owner, turn]))
  context.after(stop)
  await new Promise((resolve) => setTimeout(resolve, 300))

  appendFileSync(path.join(root, 'project', 'native-3.jsonl'), 'prompt\ntool call\n')
  await eventually(() => (activity.length > 0 ? true : undefined))

  assert.deepEqual(activity, [['native-3', 'open']])
})

test('finds the newest turn marker behind lines that carry none', async (context) => {
  const root = await directory(context)
  const file = path.join(root, 'native-1.jsonl')
  const filler = `${'tool output '.repeat(10_000)}\n`
  writeFileSync(file, `prompt one\nanswer one\nprompt two\n${filler.repeat(3)}`)

  assert.equal(latestTurn(file, files(root).turnOf), 'open')
  appendFileSync(file, 'answer two\n')
  assert.equal(latestTurn(file, files(root).turnOf), 'closed')
  assert.equal(latestTurn(path.join(root, 'missing.jsonl'), files(root).turnOf), null)
})

test('reads no turn from a file whose marker lies beyond the scanned window', async (context) => {
  const root = await directory(context)
  const file = path.join(root, 'native-1.jsonl')
  writeFileSync(file, `prompt\n${`${'x'.repeat(1023)}\n`.repeat(1100)}`)

  assert.equal(latestTurn(file, files(root).turnOf), null)
})
