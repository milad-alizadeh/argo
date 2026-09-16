import path from 'node:path'
import type { SessionChain } from '@/core/sessions/chains'
import { transcriptFileFrom } from '@/core/sessions/transcript'
import { createTranscriptRecordReader } from '@/core/sessions/transcript-lines'
import { transcriptPaths } from './discover'
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
  const records = await readRecords(filePath).catch(() => null)
  if (records === null) return null
  return {
    id: delegationId,
    retiredIds: [],
    files: [transcriptFileFrom(filePath, { fileName: path.basename(filePath), records })],
    originUnread: false,
  }
}
