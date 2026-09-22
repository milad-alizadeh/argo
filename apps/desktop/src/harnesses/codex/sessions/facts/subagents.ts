import type { SessionChain } from '@/domains/sessions/contract/model/transcript/chains'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript/transcript'
import { createTranscriptRecordReader } from '@/domains/sessions/main'
import { normalizeCodexMessageRecords } from '../discovery/discover'
import { transcriptPaths } from '../discovery/transcript-paths'
import { parseCodexTranscriptLine } from '../records/records'

const { readRecords } = createTranscriptRecordReader(parseCodexTranscriptLine)

export async function readSubagentChain(
  root: string,
  subagentId: string,
): Promise<SessionChain | null> {
  const filePath = (await transcriptPaths(root)).find((file) => file.sessionId === subagentId)?.path
  if (filePath === undefined) return null
  const records = await readRecords(filePath)
    .then(normalizeCodexMessageRecords)
    .catch(() => null)
  if (records === null) return null
  return {
    id: subagentId,
    retiredIds: [],
    files: [transcriptFileFrom(filePath, { sessionId: subagentId, records })],
    originUnread: false,
  }
}
