// A selected Feed resumes from its own prior pass rather than parsing its transcript whole again.
import assert from 'node:assert/strict'
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { createTranscriptRecordReader } from '@/harnesses/session/transcript-lines'

async function tempFile(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-transcript-lines-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return path.join(root, 'transcript.jsonl')
}

// `readRecords` always probes the unfinished tail after a full line, empty or not, so an empty
// line is not counted: it is not a line the CLI wrote and never carries a real parse cost.
function countingParser(counts: { calls: number }) {
  return (line: string): TranscriptRecord | null => {
    if (line === '') return null
    counts.calls += 1
    return { kind: 'unreadable' as const, line }
  }
}

test('a file read once already held is resumed, not reparsed, on the next read', async (context) => {
  const file = await tempFile(context)
  await writeFile(file, 'first\n')
  const counts = { calls: 0 }
  const { readRecords } = createTranscriptRecordReader(countingParser(counts))

  // The Roster's first pass over a file it has never seen.
  await readRecords(file)
  assert.equal(counts.calls, 1)

  // The CLI appends, and the Feed opens the same file next.
  await appendFile(file, 'second\n')
  await readRecords(file)

  assert.equal(counts.calls, 2, 'the held line was reparsed instead of resumed')
})

test('a file read for the first time by the Feed still resumes on a later poll', async (context) => {
  const file = await tempFile(context)
  await writeFile(file, 'first\n')
  const counts = { calls: 0 }
  const { readRecords } = createTranscriptRecordReader(countingParser(counts))

  await readRecords(file)
  await appendFile(file, 'second\n')
  await readRecords(file)
  await appendFile(file, 'third\n')
  await readRecords(file)

  assert.equal(counts.calls, 3)
})

test('releasing one Session does not discard another selected Feed’s records', async (context) => {
  const first = await tempFile(context)
  const second = `${first}.second`
  await writeFile(first, 'first\n')
  await writeFile(second, 'second\n')
  const calls = new Map<string, number>()
  const { clear, readRecords } = createTranscriptRecordReader((line) => {
    calls.set(line, (calls.get(line) ?? 0) + 1)
    return { kind: 'unreadable', line }
  })

  await readRecords(first)
  await readRecords(second)
  clear([first])
  await appendFile(second, 'second-appended\n')
  await readRecords(second)

  assert.equal(calls.get('second'), 1)
  assert.equal(calls.get('second-appended'), 1)
})
