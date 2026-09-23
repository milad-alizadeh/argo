import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { sessionFeedRowSchema } from '@/domains/sessions/contract/model/feed/feed-rows'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript/transcript'
import { readTranscriptFile } from '@/domains/sessions/contract/model/transcript/transcript-file'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { parseTranscriptLine } from '@/harnesses/claude/transcript'
import { parseCodexTranscriptLine } from '@/harnesses/codex/sessions/records'
import { isRecord } from '@/shared/validation'

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

const RAW_TAG = /<\/?[a-z][a-z0-9_-]*(?:\s[^>]*)?>/i
const PARSERS = { claude: parseTranscriptLine, codex: parseCodexTranscriptLine }
const REQUIRED_ENVELOPES = {
  claude: ['task-notification', 'pasted_content', 'bash-input', 'bash-stdout', 'bash-stderr'],
  codex: ['task-notification'],
} as const
const ENVELOPE_WAIT_MS = 120_000
const ENVELOPE_POLL_MS = 250
type RequiredEnvelope = (typeof REQUIRED_ENVELOPES)[SessionHarness][number]
type EnvelopeRecord = {
  envelope: RequiredEnvelope
  line: string
  record: TranscriptRecord
}

function envelopeIn(line: string, envelope: string) {
  return new RegExp(`<${envelope}(?:\\s|>)`, 'i').test(line)
}

function assertNoProseFallback(harness: SessionHarness, line: string, record: TranscriptRecord) {
  if (record.kind !== 'message') return
  assert.equal(
    record.blocks.some((block) => block.shape === 'prose' && RAW_TAG.test(block.text)),
    false,
    `${harness} known envelope fell back to plain prose: ${line}`,
  )
}

function assertTaskNotification(harness: SessionHarness, line: string, record: TranscriptRecord) {
  const isStructured =
    record.kind === 'event' ||
    record.kind === 'background-task' ||
    record.kind === 'subagent' ||
    (record.kind === 'message' &&
      record.blocks.some((block) => block.shape === 'event' && block.event === 'status'))
  assert.equal(isStructured, true, `${harness} task notification was not structured: ${line}`)
}

function assertPastedContent(harness: SessionHarness, line: string, record: TranscriptRecord) {
  assert.equal(
    record.kind === 'message' && record.blocks.some((block) => block.shape === 'pasted-content'),
    true,
    `${harness} pasted content was not structured: ${line}`,
  )
}

function assertBashEnvelope({
  harness,
  line,
  record,
  envelope,
}: {
  harness: SessionHarness
  line: string
  record: TranscriptRecord
  envelope: 'bash-input' | 'bash-stdout' | 'bash-stderr'
}) {
  switch (envelope) {
    case 'bash-input':
      assert.equal(
        record.kind === 'message' &&
          record.blocks.some((block) => block.shape === 'event' && block.event === 'command'),
        true,
        `${harness} Bash input was not structured: ${line}`,
      )
      return
    case 'bash-stdout':
    case 'bash-stderr':
      assert.equal(
        record.kind === 'command-output',
        true,
        `${harness} Bash output was not structured: ${line}`,
      )
  }
}

function assertKnownRecords(
  harness: SessionHarness,
  lines: string[],
  observed: Set<RequiredEnvelope>,
): EnvelopeRecord[] {
  const envelopeRecords: EnvelopeRecord[] = []
  for (const line of lines) {
    const source: unknown = JSON.parse(line)
    assert.ok(isRecord(source), `${harness} transcript line was not an object: ${line}`)
    const record = PARSERS[harness](line)
    const envelopes = REQUIRED_ENVELOPES[harness].filter((envelope) => envelopeIn(line, envelope))
    assert.ok(record || envelopes.length === 0, `${harness} known envelope was dropped: ${line}`)
    if (record === null) continue
    assert.notEqual(record.kind, 'unreadable', `${harness} record was unreadable: ${line}`)
    for (const envelope of envelopes) {
      observed.add(envelope)
      envelopeRecords.push({ envelope, line, record })
      switch (envelope) {
        case 'task-notification':
          assertTaskNotification(harness, line, record)
          break
        case 'pasted_content':
          assertPastedContent(harness, line, record)
          break
        case 'bash-input':
        case 'bash-stdout':
        case 'bash-stderr':
          assertBashEnvelope({ harness, line, record, envelope })
          break
      }
    }
    if (envelopes.length > 0) assertNoProseFallback(harness, line, record)
  }
  return envelopeRecords
}

function toolRows(rows: ReturnType<typeof projectFeed>['rows']) {
  return rows.flatMap((row) => {
    if (row.shape === 'tool') return [row]
    if (row.shape === 'tool-group') return row.calls
    return []
  })
}

function hasStatusRow(record: TranscriptRecord, rows: ReturnType<typeof projectFeed>['rows']) {
  switch (record.kind) {
    case 'event':
      return rows.some(
        (row) => row.shape === 'event' && row.id === record.uuid && row.event === 'status',
      )
    case 'subagent':
      return rows.some((row) => row.shape === 'subagent' && row.id === record.uuid)
    case 'background-task': {
      const status = {
        completed: 'succeeded',
        failed: 'failed',
        interrupted: 'interrupted',
      }[record.state]
      return toolRows(rows).some(
        (row) => row.id === record.callId && row.kind === 'command' && row.status === status,
      )
    }
    case 'message':
      return record.blocks.some(
        (block, index) =>
          block.shape === 'event' &&
          block.event === 'status' &&
          rows.some(
            (row) =>
              row.shape === 'event' &&
              row.id === `${record.uuid}:${index}` &&
              row.event === 'status',
          ),
      )
    case 'command-output':
    case 'link':
    case 'title':
    case 'skill-body':
    case 'trace':
    case 'pull-request':
    case 'plan':
    case 'compaction':
    case 'compaction-summary':
    case 'setup':
    case 'usage':
    case 'turn':
    case 'unreadable':
      return false
  }
}

function hasEnvelopeFeedRow(
  { envelope, record }: EnvelopeRecord,
  rows: ReturnType<typeof projectFeed>['rows'],
) {
  switch (envelope) {
    case 'task-notification':
      return hasStatusRow(record, rows)
    case 'pasted_content':
      return (
        record.kind === 'message' &&
        record.blocks.some(
          (block) =>
            block.shape === 'pasted-content' &&
            rows.some(
              (row) =>
                row.shape === 'prose' &&
                row.pastedContent?.some((content) => content.id === block.id) === true,
            ),
        )
      )
    case 'bash-input':
      return (
        record.kind === 'message' &&
        record.blocks.some(
          (block, index) =>
            block.shape === 'event' &&
            block.event === 'command' &&
            rows.some(
              (row) =>
                row.shape === 'event' &&
                row.id === `${record.uuid}:${index}` &&
                row.event === 'command',
            ),
        )
      )
    case 'bash-stdout':
    case 'bash-stderr':
      return (
        record.kind === 'command-output' &&
        rows.some((row) => row.shape === 'command-output' && row.id === record.uuid)
      )
  }
}

function assertEnvelopeFeedRows(
  harness: SessionHarness,
  envelopeRecords: EnvelopeRecord[],
  rows: ReturnType<typeof projectFeed>['rows'],
) {
  for (const envelopeRecord of envelopeRecords) {
    assert.equal(
      hasEnvelopeFeedRow(envelopeRecord, rows),
      true,
      `${harness} ${envelopeRecord.envelope} record produced no required Feed row: ${envelopeRecord.line}`,
    )
  }
}

function assertRequiredEnvelopes(
  harness: SessionHarness,
  observed: Set<RequiredEnvelope>,
  expected: readonly RequiredEnvelope[] = REQUIRED_ENVELOPES[harness],
) {
  assert.deepEqual(
    [...observed].sort(),
    [...expected].sort(),
    `${harness} transcript corpus did not exercise every required raw-tag shape`,
  )
}

async function waitForRequiredEnvelopes(options: {
  roots: Record<SessionHarness, string>
  sessionIds: Record<SessionHarness, string>
  expectedEnvelopes: Partial<Record<SessionHarness, readonly RequiredEnvelope[]>>
  waitMs: number
}) {
  const { roots, sessionIds, expectedEnvelopes, waitMs } = options
  const deadline = Date.now() + waitMs
  for (;;) {
    const missing: string[] = []
    for (const harness of ['claude', 'codex'] as const) {
      const files = (await transcriptPaths(roots[harness])).filter((filePath) =>
        filePath.includes(sessionIds[harness]),
      )
      const lines = await Promise.all(
        files.map((filePath) => readFile(filePath, 'utf8').catch(() => '')),
      )
      const expected = expectedEnvelopes[harness] ?? REQUIRED_ENVELOPES[harness]
      for (const envelope of expected)
        if (!lines.some((text) => envelopeIn(text, envelope)))
          missing.push(`${harness}:${envelope}`)
    }
    if (missing.length === 0) return
    if (Date.now() >= deadline)
      throw new Error(`Real transcript corpus missed required envelopes: ${missing.join(', ')}`)
    await new Promise((resolve) => setTimeout(resolve, ENVELOPE_POLL_MS))
  }
}

function assertPastedContentOrder(
  harness: SessionHarness,
  records: TranscriptRecord[],
  rows: ReturnType<typeof projectFeed>['rows'],
) {
  for (const record of records) {
    if (record.kind !== 'message' || record.role !== 'user') continue
    const expected = record.blocks.flatMap((block) => {
      if (block.shape === 'prose' && block.text !== '') return [`prose:${block.text}`]
      if (block.shape === 'pasted-content') return [`pasted:${block.id}`]
      return []
    })
    if (!expected.some((item) => item.startsWith('pasted:'))) continue
    const actual = rows
      .filter((row) => row.id.startsWith(`${record.uuid}:`) && row.shape === 'prose')
      .flatMap((row) => [
        ...(row.text === '' ? [] : [`prose:${row.text}`]),
        ...(row.pastedContent ?? []).map((content) => `pasted:${content.id}`),
      ])
    assert.deepEqual(actual, expected, `${harness} Feed reordered pasted content around prose`)
  }
}

function assertFeedRows(harness: SessionHarness, rows: ReturnType<typeof projectFeed>['rows']) {
  for (const row of rows) {
    assert.equal(
      sessionFeedRowSchema.safeParse(row).success,
      true,
      `${harness} row has an unknown shape`,
    )
    assert.equal(
      RAW_TAG.test(JSON.stringify(row)),
      false,
      `${harness} Feed row contains raw tag text: ${JSON.stringify(row)}`,
    )
  }
}

async function auditTranscript(
  harness: SessionHarness,
  filePath: string,
  observed: Set<RequiredEnvelope>,
) {
  const lines = (await readFile(filePath, 'utf8')).split('\n').filter((line) => line.trim() !== '')
  const envelopeRecords = assertKnownRecords(harness, lines, observed)
  const file = readTranscriptFile(filePath, {
    sessionId: path.basename(filePath, '.jsonl'),
    lines,
    parse: PARSERS[harness],
  })
  const chain = stitchChains([file])[0]
  assert.ok(chain, `${harness} transcript ${filePath} did not form a Session chain`)
  const rows = projectFeed(chain, undefined).rows
  assertFeedRows(harness, rows)
  assertEnvelopeFeedRows(harness, envelopeRecords, rows)
  assertPastedContentOrder(harness, file.records, rows)
}

export async function assertTranscriptFeedCorpus(options: {
  roots: Record<SessionHarness, string>
  sessionIds: Record<SessionHarness, string>
  expectedEnvelopes?: Partial<Record<SessionHarness, readonly RequiredEnvelope[]>>
  waitMs?: number
}): Promise<void> {
  const {
    roots,
    sessionIds,
    expectedEnvelopes = REQUIRED_ENVELOPES,
    waitMs = ENVELOPE_WAIT_MS,
  } = options
  await waitForRequiredEnvelopes({ roots, sessionIds, expectedEnvelopes, waitMs })
  for (const harness of ['claude', 'codex'] as const) {
    const files = (await transcriptPaths(roots[harness])).filter((filePath) =>
      filePath.includes(sessionIds[harness]),
    )
    assert.ok(files.length > 0, `the real ${harness} CLI recorded no transcript corpus`)
    const observed = new Set<RequiredEnvelope>()
    for (const filePath of files) await auditTranscript(harness, filePath, observed)
    assertRequiredEnvelopes(harness, observed, expectedEnvelopes[harness])
  }
}
