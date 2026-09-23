import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { sessionFeedRowSchema } from '@/domains/sessions/contract/model/feed/feed-rows'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
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
const KNOWN_SHAPES: Record<SessionHarness, (source: Record<string, unknown>) => boolean> = {
  claude: (source) => source.type === 'user' || source.type === 'assistant',
  codex: (source) => source.type === 'response_item',
}

function assertKnownRecords(harness: SessionHarness, lines: string[]) {
  for (const line of lines) {
    const source: unknown = JSON.parse(line)
    assert.ok(isRecord(source), `${harness} transcript line was not an object: ${line}`)
    const record = PARSERS[harness](line)
    if (KNOWN_SHAPES[harness](source)) {
      assert.ok(record, `${harness} record was dropped: ${line}`)
      assert.notEqual(record.kind, 'unreadable', `${harness} record was unreadable: ${line}`)
    }
    if (KNOWN_ENVELOPES.test(line) && record?.kind === 'message') {
      assert.equal(
        record.blocks.some((block) => block.shape === 'prose' && RAW_TAG.test(block.text)),
        false,
        `${harness} known envelope fell back to plain prose: ${line}`,
      )
    }
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
  assertFeedRows(harness, projectFeed(chain, undefined).rows)
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
