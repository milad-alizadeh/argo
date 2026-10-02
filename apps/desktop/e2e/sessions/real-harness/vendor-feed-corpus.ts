import assert from 'node:assert/strict'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { type SessionFeedRow, sessionFeedRowSchema } from '@/domains/sessions/api/feed/feed-rows'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import type { ThreadReadResponse } from '@/harnesses/codex/app-server'
import { readCodexSessionHistory } from '@/harnesses/codex/session/codex-session-history'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { recordedThreadRequest } from '../../../mocks/cli/codex/recorded-codex-threads'
import { realClaudeCli } from './real-claude-harness'
import { realCodexCli } from './real-codex-harness'
import type { VendorHistoryReader } from './vendor-reply'

type CodexThread = ThreadReadResponse['thread']
// What each Harness's own history reader returned: the Agent SDK's messages, Codex's thread read.
export type VendorCorpus = { claude: readonly SessionMessage[]; codex: CodexThread }
type VendorHarness = keyof VendorCorpus
const VENDOR_HARNESSES: VendorHarness[] = ['claude', 'codex']

const RAW_TAG = /<\/?[a-z][a-z0-9_-]*(?:\s[^>]*)?>/i
const PASTED_BLOCK = /<pasted_content id="([^"]+)">([\s\S]*?)<\/pasted_content id="\1">/g
const REQUIRED_ENVELOPES = {
  claude: ['task-notification', 'pasted_content', 'bash-input', 'bash-stdout', 'bash-stderr'],
  codex: ['task-notification'],
} as const
const ENVELOPE_WAIT_MS = 120_000
const ENVELOPE_POLL_MS = 250

type RequiredEnvelope = (typeof REQUIRED_ENVELOPES)[VendorHarness][number]
type ToolCall = Extract<SessionFeedRow, { shape: 'tool' }>

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}

// Tag checks read every string the vendor returned for one record.
function recordText(record: unknown): string {
  return stringsIn(record).join('\n')
}

function envelopeIn(record: unknown, envelope: string) {
  return new RegExp(`<${envelope}(?:\\s|>)`, 'i').test(recordText(record))
}

function tagged(record: unknown, name: string): string | null {
  return recordText(record).match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null
}

function claudeRecordId(record: unknown): string | null {
  if (typeof record !== 'object' || record === null || !('uuid' in record)) return null
  return typeof record.uuid === 'string' ? record.uuid : null
}

// The vendor records the envelopes are looked for in: one per message or thread item.
function recordsOf(harness: VendorHarness, corpus: VendorCorpus): unknown[] {
  switch (harness) {
    case 'claude':
      return [...corpus.claude]
    case 'codex':
      return corpus.codex.turns.flatMap((turn) => turn.items)
  }
}

// The Feed content Argo projects from the same vendor read.
async function contentOf(harness: VendorHarness, corpus: VendorCorpus): Promise<FeedContent[]> {
  switch (harness) {
    case 'claude':
      return decodeClaudeSessionMessages(corpus.claude)
    case 'codex':
      return readCodexSessionHistory(recordedThreadRequest(corpus.codex), corpus.codex.id)
  }
}

function rowsOf(harness: VendorHarness, content: readonly FeedContent[]): SessionFeedRow[] {
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

function assertNoProseTag(harness: VendorHarness, rows: readonly SessionFeedRow[]) {
  for (const text of proseTexts(rows)) {
    assert.equal(RAW_TAG.test(text), false, `${harness} prose holds a raw tag: ${text}`)
  }
}

function assertTaskNotification(
  harness: VendorHarness,
  records: readonly unknown[],
  rows: readonly SessionFeedRow[],
) {
  for (const record of records) {
    if (!envelopeIn(record, 'task-notification')) continue
    const summary = tagged(record, 'summary') ?? tagged(record, 'result')
    assert.ok(summary !== null && summary !== '', `${harness} task notification named no summary`)
    assert.ok(
      rows.some((row) => {
        const task = row.shape === 'event' && row.event === 'task'
        const subagent = row.shape === 'subagent'
        return (task || subagent) && row.text?.includes(summary) === true
      }),
      `${harness} task notification was not a task row: ${recordText(record)}`,
    )
  }
}

function assertPastedContent(
  harness: VendorHarness,
  records: readonly unknown[],
  rows: readonly SessionFeedRow[],
) {
  const expected = records.flatMap((record) =>
    [...recordText(record).matchAll(PASTED_BLOCK)].flatMap((match) => {
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
  harness: VendorHarness,
  records: readonly unknown[],
  rows: readonly SessionFeedRow[],
) {
  const calls = toolCalls(rows)
  for (const record of records) {
    if (!envelopeIn(record, 'bash-input')) continue
    const command = tagged(record, 'bash-input')
    assert.ok(command !== null, `${harness} bash input named no command`)
    assert.ok(
      calls.some(
        (call) => call.kind === 'command' && call.text === command && call.status === 'running',
      ),
      `${harness} bash input was not a running command row: ${recordText(record)}`,
    )
  }
}

function assertBashOutput({
  harness,
  records,
  rows,
  envelope,
}: {
  harness: VendorHarness
  records: readonly unknown[]
  rows: readonly SessionFeedRow[]
  envelope: 'bash-stdout' | 'bash-stderr'
}) {
  const calls = toolCalls(rows)
  for (const record of records) {
    if (!envelopeIn(record, envelope)) continue
    const id = claudeRecordId(record)
    const body = tagged(record, envelope)
    assert.ok(id !== null, `${harness} ${envelope} record carried no uuid`)
    assert.ok(
      calls.some((call) => {
        if (call.kind !== 'command' || call.id !== id || call.status !== 'succeeded') return false
        const source = commandSource(call)
        if (RAW_TAG.test(source) || RAW_TAG.test(call.text ?? '')) return false
        return body === null || body === '' || source.includes(body)
      }),
      `${harness} ${envelope} was not a command row: ${recordText(record)}`,
    )
  }
}

function assertEnvelope({
  harness,
  envelope,
  records,
  rows,
}: {
  harness: VendorHarness
  envelope: RequiredEnvelope
  records: readonly unknown[]
  rows: readonly SessionFeedRow[]
}) {
  switch (envelope) {
    case 'task-notification':
      assertTaskNotification(harness, records, rows)
      return
    case 'pasted_content':
      assertPastedContent(harness, records, rows)
      return
    case 'bash-input':
      assertBashInput(harness, records, rows)
      return
    case 'bash-stdout':
    case 'bash-stderr':
      assertBashOutput({ harness, records, rows, envelope })
      return
  }
}

function observedEnvelopes(harness: VendorHarness, records: readonly unknown[]) {
  const observed = new Set<RequiredEnvelope>()
  for (const record of records) {
    for (const envelope of REQUIRED_ENVELOPES[harness]) {
      if (envelopeIn(record, envelope)) observed.add(envelope)
    }
  }
  return observed
}

function missingEnvelopes(
  corpus: VendorCorpus,
  expectedEnvelopes: Partial<Record<VendorHarness, readonly RequiredEnvelope[]>>,
): string[] {
  return VENDOR_HARNESSES.flatMap((harness) => {
    const observed = observedEnvelopes(harness, recordsOf(harness, corpus))
    const expected = expectedEnvelopes[harness] ?? REQUIRED_ENVELOPES[harness]
    return expected
      .filter((envelope) => !observed.has(envelope))
      .map((envelope) => `${harness}:${envelope}`)
  })
}

async function readVendorCorpus(
  readers: {
    claude: VendorHistoryReader<SessionMessage[]>
    codex: VendorHistoryReader<CodexThread>
  },
  sessionIds: Record<VendorHarness, string>,
): Promise<VendorCorpus> {
  return {
    claude: await readers.claude.records(sessionIds.claude),
    codex: await readers.codex.records(sessionIds.codex),
  }
}

// Polls the real CLIs' own readers under the throwaway HOME until both Sessions hold every envelope.
export async function readRealVendorCorpus(options: {
  home: string
  sessionIds: Record<VendorHarness, string>
  expectedEnvelopes?: Partial<Record<VendorHarness, readonly RequiredEnvelope[]>>
}): Promise<VendorCorpus> {
  const { home, sessionIds, expectedEnvelopes = REQUIRED_ENVELOPES } = options
  const codex = findExecutableOnLoginShellPath('codex')
  if (codex === null) throw new Error('codex is not available on PATH.')
  const readers = {
    claude: await realClaudeCli.openReader(home, ''),
    codex: await realCodexCli.openReader(home, codex),
  }
  try {
    const deadline = Date.now() + ENVELOPE_WAIT_MS
    // A thread Codex has not written yet fails its read; the timeout names the last failure.
    let lastFailure: unknown = null
    for (;;) {
      const corpus = await readVendorCorpus(readers, sessionIds).catch((error: unknown) => {
        lastFailure = error
        return null
      })
      const missing =
        corpus === null ? ['a vendor read'] : missingEnvelopes(corpus, expectedEnvelopes)
      if (corpus !== null && missing.length === 0) return corpus
      if (Date.now() >= deadline) {
        const failure =
          lastFailure === null ? '' : `\nLast vendor read failure: ${String(lastFailure)}`
        throw new Error(`Real vendor corpus missed: ${missing.join(', ')}${failure}`)
      }
      await new Promise((resolve) => setTimeout(resolve, ENVELOPE_POLL_MS))
    }
  } finally {
    readers.claude.close()
    readers.codex.close()
  }
}

export async function assertVendorFeedCorpus(
  corpus: VendorCorpus,
  expectedEnvelopes: Partial<
    Record<VendorHarness, readonly RequiredEnvelope[]>
  > = REQUIRED_ENVELOPES,
): Promise<void> {
  for (const harness of VENDOR_HARNESSES) {
    const records = recordsOf(harness, corpus)
    const rows = rowsOf(harness, await contentOf(harness, corpus))
    assertNoProseTag(harness, rows)
    const observed = observedEnvelopes(harness, records)
    const expected = expectedEnvelopes[harness] ?? REQUIRED_ENVELOPES[harness]
    assert.deepEqual(
      [...observed].sort(),
      [...expected].sort(),
      `${harness} vendor corpus did not exercise every required raw-tag shape`,
    )
    for (const envelope of expected) assertEnvelope({ harness, envelope, records, rows })
  }
}
