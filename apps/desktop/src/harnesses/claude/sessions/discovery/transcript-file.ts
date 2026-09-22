import {
  readTranscriptFile as read,
  type TranscriptFile,
  withoutBlocks,
} from '@/domains/sessions/contract/model/transcript/transcript'
import { parseTranscriptLine } from '../records/records'
import { normalizeClaudeRecords } from './normalize-records'

export type { TranscriptFile }
export { withoutBlocks }

export function readTranscriptFile(
  path: string,
  { sessionId, lines }: { sessionId: string; lines: Iterable<string> },
) {
  const file = read(path, { sessionId, lines, parse: parseTranscriptLine })
  return { ...file, records: normalizeClaudeRecords(file.records) }
}
