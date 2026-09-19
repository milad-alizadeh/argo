import {
  readTranscriptFile as read,
  type TranscriptFile,
  withoutBlocks,
} from '../../../domains/sessions/contract/transcript'
import { normalizeClaudeRecords } from './normalize-records'
import { parseTranscriptLine } from './records'

export type { TranscriptFile }
export { withoutBlocks }

export function readTranscriptFile(
  path: string,
  { fileName, lines }: { fileName: string; lines: Iterable<string> },
) {
  const file = read(path, { fileName, lines, parse: parseTranscriptLine })
  return { ...file, records: normalizeClaudeRecords(file.records) }
}
