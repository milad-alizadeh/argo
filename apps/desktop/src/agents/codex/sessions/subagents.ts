import path from 'node:path'
import type { SessionChain } from '../../../domains/sessions/contract/chains'
import { transcriptFileFrom } from '../../../domains/sessions/contract/transcript'
import { createTranscriptRecordReader } from '../../../domains/sessions/main/transcript-lines'
import { normalizeCodexMessageRecords, transcriptPaths } from './discover'
import { parseCodexTranscriptLine } from './records'

const { readRecords } = createTranscriptRecordReader(parseCodexTranscriptLine)

export async function readDelegationChain(
  root: string,
  delegationId: string,
): Promise<SessionChain | null> {
  const filePath = (await transcriptPaths(root)).find(
    ({ name }) => name === `${delegationId}.jsonl`,
  )?.path
  if (filePath === undefined) return null
  const records = await readRecords(filePath)
    .then(normalizeCodexMessageRecords)
    .catch(() => null)
  if (records === null) return null
  return {
    id: delegationId,
    retiredIds: [],
    files: [transcriptFileFrom(filePath, { fileName: path.basename(filePath), records })],
    originUnread: false,
  }
}
