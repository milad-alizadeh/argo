import {
  readTranscriptFile as read,
  type TranscriptFile,
  withoutBlocks,
} from '@/core/sessions/transcript'
import { parseTranscriptLine } from './records'

export type { TranscriptFile }
export { withoutBlocks }

export function readTranscriptFile(
  path: string,
  { fileName, lines }: { fileName: string; lines: Iterable<string> },
) {
  return read(path, { fileName, lines, parse: parseTranscriptLine })
}
