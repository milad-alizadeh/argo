import { randomUUID } from 'node:crypto'
import { recordedClaudeCompactionChain } from '../../recordings/claude-cli.ts'

const recordedBoundary = recordedClaudeCompactionChain.find(
  (record) => 'subtype' in record && record.subtype === 'compact_boundary',
)
if (recordedBoundary === undefined)
  throw new Error('The Claude recording holds no compact_boundary.')

type Compaction = { sessionId: string; cwd: string; logicalParentUuid: string | null }

// The records real Claude writes on `/compact`: a boundary that starts a new chain, then the summary
// the next prompt chains to, live or resumed (claude-cli/<version>/compaction-chain.json).
export function compactionRecords({ sessionId, cwd, logicalParentUuid }: Compaction) {
  const timestamp = new Date().toISOString()
  const boundary = {
    ...recordedBoundary,
    parentUuid: null,
    logicalParentUuid,
    uuid: randomUUID(),
    timestamp,
    cwd,
    sessionId,
  }
  const summary = {
    type: 'user',
    sessionId,
    cwd,
    timestamp,
    uuid: randomUUID(),
    parentUuid: boundary.uuid,
    isSidechain: false,
    isCompactSummary: true,
    isVisibleInTranscriptOnly: true,
    message: {
      role: 'user',
      content:
        'This session is being continued from a previous conversation that ran out of context.',
    },
  }
  return { boundary, summary }
}
