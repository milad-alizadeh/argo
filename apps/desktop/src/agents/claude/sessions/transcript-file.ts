import { normalizeClaudeRecords } from '@/agents/claude/sessions/normalize-records'
import { parseTranscriptLine } from '@/agents/claude/sessions/records'
import {
  readTranscriptFile as read,
  type TranscriptFile,
  withoutBlocks,
} from '@/domains/sessions/contract/model/transcript'

export type { TranscriptFile }
export { withoutBlocks }

export function readTranscriptFile(
  path: string,
  { sessionId, lines }: { sessionId: string; lines: Iterable<string> },
) {
  const file = read(path, { sessionId, lines, parse: parseTranscriptLine })
  return { ...file, records: normalizeClaudeRecords(file.records) }
}
