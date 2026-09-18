import {
  readTranscriptFile as read,
  type TranscriptFile,
  withoutBlocks,
} from '../../../domains/sessions/contract/transcript'
import { parseTranscriptLine } from './records'
import { readingSpawnedAgents } from './spawned-agents'

export type { TranscriptFile }
export { withoutBlocks }

export function readTranscriptFile(
  path: string,
  { fileName, lines }: { fileName: string; lines: Iterable<string> },
) {
  const file = read(path, { fileName, lines, parse: parseTranscriptLine })
  return { ...file, records: readingSpawnedAgents(file.records) }
}
