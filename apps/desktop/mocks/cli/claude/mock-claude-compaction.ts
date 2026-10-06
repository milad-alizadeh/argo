import { randomUUID } from 'node:crypto'
import { recordedClaudeCompactionChain } from '../../recordings/claude-cli.ts'

function recordedRecord(matches: (record: Record<string, unknown>) => boolean, name: string) {
  const record = recordedClaudeCompactionChain.find((entry) => matches(entry))
  if (record === undefined) throw new Error(`The Claude compaction recording holds no ${name}.`)
  return record
}

const recordedBoundary = recordedRecord(
  (record) => record.subtype === 'compact_boundary',
  'compact_boundary',
)
const recordedSummary = recordedRecord(
  (record) => record.isCompactSummary === true,
  'compaction summary',
)

// The records real Claude writes on `/compact`, with the recording's fields: a boundary that starts
// a new chain, then the summary the next prompt chains to, live or resumed (claude-cli/<version>/compaction-chain.json).
export function compactionRecords(session: {
  sessionId: string
  cwd: string
  logicalParentUuid: string | null
}) {
  const { sessionId, cwd, logicalParentUuid } = session
  const ids = { cwd, sessionId, timestamp: new Date().toISOString() }
  const boundary = {
    ...recordedBoundary,
    ...ids,
    uuid: randomUUID(),
    parentUuid: null,
    logicalParentUuid,
  }
  const summary = {
    ...recordedSummary,
    ...ids,
    session_id: sessionId,
    uuid: randomUUID(),
    parentUuid: boundary.uuid,
  }
  return { boundary, summary }
}
