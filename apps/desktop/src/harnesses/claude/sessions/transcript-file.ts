import {
  readTranscriptFile as read,
  type TranscriptFile,
  withoutBlocks,
} from '@/domains/sessions/contract/transcript'
import { normalizeClaudeRecords } from '@/harnesses/claude/sessions/normalize-records'
import { parseTranscriptLine } from '@/harnesses/claude/sessions/records'

export type { TranscriptFile }
export { withoutBlocks }

export function readTranscriptFile(
  path: string,
  { sessionId, lines }: { sessionId: string; lines: Iterable<string> },
) {
  const file = read(path, { sessionId, lines, parse: parseTranscriptLine })
  return { ...file, records: normalizeClaudeRecords(file.records) }
}
