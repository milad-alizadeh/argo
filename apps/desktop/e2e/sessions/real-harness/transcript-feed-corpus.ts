import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { sessionFeedRowSchema } from '@/domains/sessions/contract/model/feed/feed-rows'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript/transcript'
import { readTranscriptFile } from '@/domains/sessions/contract/model/transcript/transcript-file'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { parseTranscriptLine } from '@/harnesses/claude/sessions/records'
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
const KNOWN_ENVELOPES =
  /<(?:task-notification|pasted_content|bash-input|bash-stdout|bash-stderr)(?:\s|>)/i
const PARSERS = { claude: parseTranscriptLine, codex: parseCodexTranscriptLine }
const REQUIRED_ENVELOPES = {
  claude: ['task-notification', 'pasted_content', 'bash-input', 'bash-stdout', 'bash-stderr'],
  codex: ['task-notification'],
} as const

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
  if (!/<task-notification(?:\s|>)/i.test(line)) return
  const isStructured =
    record.kind === 'event' ||
    record.kind === 'background-task' ||
    record.kind === 'subagent' ||
    (record.kind === 'message' &&
      record.blocks.some((block) => block.shape === 'event' && block.event === 'status'))
  assert.equal(isStructured, true, `${harness} task notification was not structured: ${line}`)
}

function assertPastedContent(harness: SessionHarness, line: string, record: TranscriptRecord) {
  if (!/<pasted_content(?:\s|>)/i.test(line)) return
  assert.equal(
    record.kind === 'message' && record.blocks.some((block) => block.shape === 'pasted-content'),
    true,
    `${harness} pasted content was not structured: ${line}`,
  )
}

function assertBashEnvelope(harness: SessionHarness, line: string, record: TranscriptRecord) {
  if (/<bash-input(?:\s|>)/i.test(line)) {
    assert.equal(
      record.kind === 'message' &&
        record.blocks.some((block) => block.shape === 'event' && block.event === 'command'),
      true,
      `${harness} Bash input was not structured: ${line}`,
    )
  }
  if (/<bash-(?:stdout|stderr)(?:\s|>)/i.test(line)) {
    assert.equal(
      record.kind === 'command-output',
      true,
      `${harness} Bash output was not structured: ${line}`,
    )
  }
}

function assertKnownRecords(harness: SessionHarness, lines: string[]) {
  const observed = new Set<string>()
  for (const line of lines) {
    const source: unknown = JSON.parse(line)
    assert.ok(isRecord(source), `${harness} transcript line was not an object: ${line}`)
    const record = PARSERS[harness](line)
    assert.ok(record, `${harness} record was dropped: ${line}`)
    assert.notEqual(record.kind, 'unreadable', `${harness} record was unreadable: ${line}`)
    if (!KNOWN_ENVELOPES.test(line)) continue
    for (const envelope of REQUIRED_ENVELOPES[harness]) {
      if (envelopeIn(line, envelope)) observed.add(envelope)
    }
    assertNoProseFallback(harness, line, record)
    assertTaskNotification(harness, line, record)
    assertPastedContent(harness, line, record)
    assertBashEnvelope(harness, line, record)
  }
  assert.deepEqual(
    [...observed].sort(),
    [...REQUIRED_ENVELOPES[harness]].sort(),
    `${harness} transcript corpus did not exercise every required raw-tag shape`,
  )
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

async function auditTranscript(harness: SessionHarness, filePath: string) {
  const lines = (await readFile(filePath, 'utf8')).split('\n').filter((line) => line.trim() !== '')
  assertKnownRecords(harness, lines)
  const file = readTranscriptFile(filePath, {
    sessionId: path.basename(filePath, '.jsonl'),
    lines,
    parse: PARSERS[harness],
  })
  const chain = stitchChains([file])[0]
  assert.ok(chain, `${harness} transcript ${filePath} did not form a Session chain`)
  const rows = projectFeed(chain, undefined).rows
  assertFeedRows(harness, rows)
  assertPastedContentOrder(harness, file.records, rows)
}

export async function assertTranscriptFeedCorpus(
  roots: Record<SessionHarness, string>,
  sessionIds: Record<SessionHarness, string>,
): Promise<void> {
  for (const harness of ['claude', 'codex'] as const) {
    const files = (await transcriptPaths(roots[harness])).filter((filePath) =>
      filePath.includes(sessionIds[harness]),
    )
    assert.ok(files.length > 0, `the real ${harness} CLI recorded no transcript corpus`)
    for (const filePath of files) await auditTranscript(harness, filePath)
  }
}
