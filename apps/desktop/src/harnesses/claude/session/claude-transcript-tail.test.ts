import { afterEach, beforeEach, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import {
  buildHistory,
  historyPath,
  refreshTurn,
  writeHistory,
} from '@/mocks/cli/claude/long-claude-history'
import { decodeClaudeSessionMessages, readClaudeSessionHistory } from './claude-session-history'
import { ClaudeTranscriptTails, transcriptTailBytes } from './claude-transcript-tail'

let root = ''
const configBefore = process.env.CLAUDE_CONFIG_DIR

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-tail-'))
  process.env.CLAUDE_CONFIG_DIR = root
})

afterEach(async () => {
  if (configBefore === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = configBefore
  await rm(root, { recursive: true, force: true })
})

// A tail reader that counts every byte it takes from the disk.
function countedTails() {
  const counted = { bytes: 0 }
  const tails = new ClaudeTranscriptTails(async (file, start, end) => {
    const handle = await open(file, 'r')
    try {
      const buffer = Buffer.alloc(end - start)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
      counted.bytes += bytesRead
      return buffer.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  })
  return { counted, tails }
}

async function writeLongHistory(megabytes: number) {
  const cwd = path.join(root, 'project')
  const nativeId = randomUUID()
  const history = buildHistory(cwd, megabytes * 1_000_000)
  const file = historyPath(path.join(root, 'projects'), cwd, nativeId)
  await writeHistory(file, history.text)
  return { cwd, nativeId, file, history }
}

test('a first read of a large transcript takes only its last mebibyte from the disk', async () => {
  const { file, history } = await writeLongHistory(5)
  const { counted, tails } = countedTails()

  const tail = await tails.read(file, transcriptTailBytes(0))

  expect(counted.bytes).toBe(transcriptTailBytes(0))
  expect(history.bytes).toBeGreaterThan(4 * transcriptTailBytes(0))
  expect(tail.whole).toBe(false)
  expect(tail.entries.at(-1)?.uuid).toBe(history.lastUuid)
})

test('a reopen of an unchanged transcript reads nothing, and a grown one only its new bytes', async () => {
  const { cwd, file, history } = await writeLongHistory(3)
  const { counted, tails } = countedTails()
  const first = await tails.read(file, transcriptTailBytes(0))
  counted.bytes = 0

  const again = await tails.read(file, transcriptTailBytes(0))
  expect(counted.bytes).toBe(0)
  expect(again.entries).toBe(first.entries)

  const appended = refreshTurn(cwd, history.lastUuid)
  await appendFile(file, appended.text)
  const grown = await tails.read(file, transcriptTailBytes(0))
  // The new bytes, and the few before them that show the file only grew.
  expect(counted.bytes).toBe(Buffer.byteLength(appended.text) + 64)
  expect(grown.entries.at(-1)?.uuid).toBe(appended.refreshUuid)
  expect(grown.entries.length).toBe(first.entries.length + 1)
})

test('a wider read takes only the bytes before the ones already parsed', async () => {
  const { file } = await writeLongHistory(3)
  const { counted, tails } = countedTails()
  const first = await tails.read(file, transcriptTailBytes(0))
  counted.bytes = 0

  const wider = await tails.read(file, transcriptTailBytes(1))

  expect(wider.whole).toBe(true)
  expect(counted.bytes).toBeLessThan(transcriptTailBytes(1) - transcriptTailBytes(0) + 1)
  expect(wider.entries.slice(-first.entries.length)).toEqual(first.entries)
})

test('a rewritten transcript is read again from its new content', async () => {
  const { cwd, file } = await writeLongHistory(1)
  const { tails } = countedTails()
  await tails.read(file, transcriptTailBytes(0))

  const other = buildHistory(cwd, 2_000, 500)
  await writeFile(file, other.text)

  expect((await tails.read(file, transcriptTailBytes(0))).entries.at(-1)?.uuid).toBe(other.lastUuid)
})

test('a transcript rewritten in place to a larger size is read again, not appended to', async () => {
  const { cwd, file } = await writeLongHistory(1)
  const { tails } = countedTails()
  await tails.read(file, transcriptTailBytes(0))

  const other = buildHistory(cwd, 2_000_000, 900)
  const handle = await open(file, 'r+')
  await handle.truncate(0)
  await handle.write(other.text, 0)
  await handle.close()

  const reread = await tails.read(file, transcriptTailBytes(0))
  expect(reread.entries.at(-1)?.uuid).toBe(other.lastUuid)
  expect(reread.entries.filter(({ uuid }) => !other.text.includes(uuid))).toEqual([])
})

test('the tail decodes to the newest rows of the whole history, and says it is cut off', async () => {
  const { cwd, nativeId, history } = await writeLongHistory(3)
  const whole = decodeClaudeSessionMessages(await getSessionMessages(nativeId, { dir: cwd }))

  const tail = await readClaudeSessionHistory({ nativeId, cwd, subagentId: null }, 0)

  expect(tail.complete).toBe(false)
  expect(tail.content.length).toBeGreaterThan(200)
  expect(tail.content).toEqual(whole.slice(-tail.content.length))
  expect(history.turns).toBeGreaterThan(tail.content.length / 4)
})

test('a tail that reaches the first message is the complete history', async () => {
  const { cwd, nativeId } = await writeLongHistory(0.5)
  const whole = decodeClaudeSessionMessages(await getSessionMessages(nativeId, { dir: cwd }))

  expect(await readClaudeSessionHistory({ nativeId, cwd, subagentId: null }, 0)).toEqual({
    content: whole,
    complete: true,
  })
})
