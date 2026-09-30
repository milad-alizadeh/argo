import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { type SessionFeedRow, sessionFeedRowSchema } from '@/domains/sessions/api/feed/feed-rows'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { openClaudeHistoryReader } from '@/harnesses/claude/session/claude-history-lines'
import { openCodexHistoryReader } from '@/harnesses/codex/session/codex-history-lines'

// One reader per transcript file, the way a real read follows that file.
const READERS = {
  claude: openClaudeHistoryReader,
  codex: openCodexHistoryReader,
} as const
// Only the Harnesses whose transcript files the corpus can read.
type TranscriptHarness = keyof typeof READERS
const TRANSCRIPT_HARNESSES = Object.keys(READERS) as TranscriptHarness[]

const RAW_TAG = /<\/?[a-z][a-z0-9_-]*(?:\s[^>]*)?>/i
const PASTED_BLOCK = /<pasted_content id="([^"]+)">([\s\S]*?)<\/pasted_content id="\1">/g
const REQUIRED_ENVELOPES = {
  claude: ['task-notification', 'pasted_content', 'bash-input', 'bash-stdout', 'bash-stderr'],
  codex: ['task-notification'],
} as const
const ENVELOPE_WAIT_MS = 120_000
const ENVELOPE_POLL_MS = 250

type RequiredEnvelope = (typeof REQUIRED_ENVELOPES)[TranscriptHarness][number]
type ToolCall = Extract<SessionFeedRow, { shape: 'tool' }>

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}

// Tag checks read the record's text, so a JSON escape cannot hide `id="…"`.
function recordText(line: string): string {
  try {
    return stringsIn(JSON.parse(line)).join('\n')
  } catch {
    return line
  }
}

function envelopeIn(line: string, envelope: string) {
  return new RegExp(`<${envelope}(?:\\s|>)`, 'i').test(recordText(line))
}

function tagged(line: string, name: string): string | null {
  return recordText(line).match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null
}

function claudeRecordId(line: string): string | null {
  try {
    const record = JSON.parse(line) as { uuid?: unknown }
    return typeof record.uuid === 'string' ? record.uuid : null
  } catch {
    return null
  }
}

async function transcriptPaths(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const paths: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) paths.push(...(await transcriptPaths(entryPath)))
    else if (entry.name.endsWith('.jsonl')) paths.push(entryPath)
  }
  return paths
}

function contentOf(
  harness: TranscriptHarness,
  files: readonly (readonly string[])[],
): FeedContent[] {
  const content: FeedContent[] = []
  for (const lines of files) {
    const read = READERS[harness]()
    for (const line of lines) {
      const change = read([line])
      // A rewritten line asks for a full read and publishes no events of its own.
      if (change.type !== 'appended') continue
      for (const event of change.events) {
        if (event.type === 'content') content.push(event.content)
      }
    }
  }
  return content
}

function rowsOf(harness: TranscriptHarness, content: readonly FeedContent[]): SessionFeedRow[] {
  const projected = projectFeedRowEntries({ history: content, live: [] })
  assert.equal(
    projected.rejected.history + projected.rejected.rows,
    0,
    `${harness} Feed projection dropped content`,
  )
  const rows = feedEntryRows(projected.entries)
  for (const row of rows) {
    assert.equal(
      sessionFeedRowSchema.safeParse(row).success,
      true,
      `${harness} row has an unknown shape`,
    )
  }
  return rows
}

function toolCalls(rows: readonly SessionFeedRow[]): ToolCall[] {
  return rows.flatMap((row) => {
    if (row.shape === 'tool') return [row]
    if (row.shape === 'tool-group') return row.calls
    return []
  })
}

function proseTexts(rows: readonly SessionFeedRow[]): string[] {
  return rows.flatMap((row) => (row.shape === 'prose' ? [row.text] : []))
}

function assertNoProseTag(harness: TranscriptHarness, rows: readonly SessionFeedRow[]) {
  for (const text of proseTexts(rows)) {
    assert.equal(RAW_TAG.test(text), false, `${harness} prose holds a raw tag: ${text}`)
  }
}

function assertTaskNotification(
  harness: TranscriptHarness,
  lines: readonly string[],
  rows: readonly SessionFeedRow[],
) {
  for (const line of lines) {
    if (!envelopeIn(line, 'task-notification')) continue
    const summary = tagged(line, 'summary') ?? tagged(line, 'result')
    assert.ok(summary !== null && summary !== '', `${harness} task notification named no summary`)
    assert.ok(
      rows.some((row) => {
        const task = row.shape === 'event' && row.event === 'task'
        const subagent = row.shape === 'subagent'
        return (task || subagent) && row.text?.includes(summary) === true
      }),
      `${harness} task notification was not a task row: ${line}`,
    )
  }
}

function assertPastedContent(
  harness: TranscriptHarness,
  lines: readonly string[],
  rows: readonly SessionFeedRow[],
) {
  const expected = lines.flatMap((line) =>
    [...recordText(line).matchAll(PASTED_BLOCK)].flatMap((match) => {
      const id = match[1]
      return id === undefined ? [] : [{ id, text: (match[2] ?? '').trim() }]
    }),
  )
  assert.ok(expected.length > 0, `${harness} pasted_content tag was not a pasted block`)
  const actual = rows.flatMap((row) => (row.shape === 'prose' ? (row.pastedContent ?? []) : []))
  for (const paste of expected) {
    assert.ok(
      actual.some((item) => item.id === paste.id && item.text === paste.text),
      `${harness} pasted content ${paste.id} was not structured`,
    )
  }
}

function commandSource(call: ToolCall): string {
  return call.evidence?.kind === 'output' ? call.evidence.source : ''
}

function assertBashInput(
  harness: TranscriptHarness,
  lines: readonly string[],
  rows: readonly SessionFeedRow[],
) {
  const calls = toolCalls(rows)
  for (const line of lines) {
    if (!envelopeIn(line, 'bash-input')) continue
    const command = tagged(line, 'bash-input')
    assert.ok(command !== null, `${harness} bash input named no command`)
    assert.ok(
      calls.some(
        (call) => call.kind === 'command' && call.text === command && call.status === 'running',
      ),
      `${harness} bash input was not a running command row: ${line}`,
    )
  }
}

function assertBashOutput({
  harness,
  lines,
  rows,
  envelope,
}: {
  harness: TranscriptHarness
  lines: readonly string[]
  rows: readonly SessionFeedRow[]
  envelope: 'bash-stdout' | 'bash-stderr'
}) {
  const calls = toolCalls(rows)
  for (const line of lines) {
    if (!envelopeIn(line, envelope)) continue
    const id = claudeRecordId(line)
    const body = tagged(line, envelope)
    assert.ok(id !== null, `${harness} ${envelope} line named no record`)
    assert.ok(
      calls.some((call) => {
        if (call.kind !== 'command' || call.id !== id || call.status !== 'succeeded') return false
        const source = commandSource(call)
        if (RAW_TAG.test(source) || RAW_TAG.test(call.text ?? '')) return false
        return body === null || body === '' || source.includes(body)
      }),
      `${harness} ${envelope} was not a command row: ${line}`,
    )
  }
}

function assertEnvelope({
  harness,
  envelope,
  lines,
  rows,
}: {
  harness: TranscriptHarness
  envelope: RequiredEnvelope
  lines: readonly string[]
  rows: readonly SessionFeedRow[]
}) {
  switch (envelope) {
    case 'task-notification':
      assertTaskNotification(harness, lines, rows)
      return
    case 'pasted_content':
      assertPastedContent(harness, lines, rows)
      return
    case 'bash-input':
      assertBashInput(harness, lines, rows)
      return
    case 'bash-stdout':
    case 'bash-stderr':
      assertBashOutput({ harness, lines, rows, envelope })
      return
  }
}

function observedEnvelopes(harness: TranscriptHarness, lines: readonly string[]) {
  const observed = new Set<RequiredEnvelope>()
  for (const line of lines) {
    for (const envelope of REQUIRED_ENVELOPES[harness]) {
      if (envelopeIn(line, envelope)) observed.add(envelope)
    }
  }
  return observed
}

async function sessionFiles(root: string, sessionId: string): Promise<string[][]> {
  const files = (await transcriptPaths(root)).filter((filePath) => filePath.includes(sessionId))
  assert.ok(files.length > 0, `${sessionId} recorded no transcript`)
  const groups: string[][] = []
  for (const filePath of files) {
    const lines = (await readFile(filePath, 'utf8'))
      .split('\n')
      .filter((line) => line.trim() !== '')
    if (lines.length > 0) groups.push(lines)
  }
  return groups
}

async function waitForRequiredEnvelopes(options: {
  roots: Record<TranscriptHarness, string>
  sessionIds: Record<TranscriptHarness, string>
  expectedEnvelopes: Partial<Record<TranscriptHarness, readonly RequiredEnvelope[]>>
  waitMs: number
}) {
  const { roots, sessionIds, expectedEnvelopes, waitMs } = options
  const deadline = Date.now() + waitMs
  for (;;) {
    const missing: string[] = []
    for (const harness of TRANSCRIPT_HARNESSES) {
      const files = (await transcriptPaths(roots[harness])).filter((filePath) =>
        filePath.includes(sessionIds[harness]),
      )
      const texts = await Promise.all(
        files.map((filePath) => readFile(filePath, 'utf8').catch(() => '')),
      )
      const expected = expectedEnvelopes[harness] ?? REQUIRED_ENVELOPES[harness]
      for (const envelope of expected) {
        const present = texts.some((fileText) =>
          fileText.split('\n').some((line) => line.trim() !== '' && envelopeIn(line, envelope)),
        )
        if (!present) missing.push(`${harness}:${envelope}`)
      }
    }
    if (missing.length === 0) return
    if (Date.now() >= deadline) {
      throw new Error(`Real transcript corpus missed required envelopes: ${missing.join(', ')}`)
    }
    await new Promise((resolve) => setTimeout(resolve, ENVELOPE_POLL_MS))
  }
}

export async function assertTranscriptFeedCorpus(options: {
  roots: Record<TranscriptHarness, string>
  sessionIds: Record<TranscriptHarness, string>
  expectedEnvelopes?: Partial<Record<TranscriptHarness, readonly RequiredEnvelope[]>>
  waitMs?: number
}): Promise<void> {
  const {
    roots,
    sessionIds,
    expectedEnvelopes = REQUIRED_ENVELOPES,
    waitMs = ENVELOPE_WAIT_MS,
  } = options
  await waitForRequiredEnvelopes({ roots, sessionIds, expectedEnvelopes, waitMs })
  for (const harness of TRANSCRIPT_HARNESSES) {
    const files = await sessionFiles(roots[harness], sessionIds[harness])
    const lines = files.flat()
    const rows = rowsOf(harness, contentOf(harness, files))
    assertNoProseTag(harness, rows)
    const observed = observedEnvelopes(harness, lines)
    const expected = expectedEnvelopes[harness] ?? REQUIRED_ENVELOPES[harness]
    assert.deepEqual(
      [...observed].sort(),
      [...expected].sort(),
      `${harness} transcript corpus did not exercise every required raw-tag shape`,
    )
    for (const envelope of expected) assertEnvelope({ harness, envelope, lines, rows })
  }
}
