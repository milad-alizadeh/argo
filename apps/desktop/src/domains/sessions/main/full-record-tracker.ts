// The full-record cache backing readSessionFiles (#2239): a Session opened for its Feed keeps its
// files' full parse held here, evicted only when the reader is done with it (#1717's HELD_FILE_LIMIT
// eviction lives one level down in transcript-lines.ts; this layer just tracks which paths belong to
// which Session id so a discard reaches every id that chain has ever answered to).
import type { SessionChain } from '@/domains/sessions/contract/chains'
import type {
  TranscriptFile,
  TranscriptParser,
  TranscriptRecord,
} from '@/domains/sessions/contract/transcript'
import { transcriptFileFrom } from '@/domains/sessions/contract/transcript'
import { createTranscriptRecordReader } from './transcript-lines'

export type FullRecordTracker = {
  readChainFiles: (chain: SessionChain) => Promise<TranscriptFile[]>
  clearFullRecords: (sessionId: string) => void
}

export function createFullRecordTracker(
  parse: TranscriptParser,
  normalizeRecords?: (records: TranscriptRecord[]) => TranscriptRecord[],
): FullRecordTracker {
  const fullRecords = createTranscriptRecordReader(parse)
  const discardedFullPaths = new Set<string>()
  const fullPaths = new Map<string, string[]>()

  async function readFullFile(file: {
    path: string
    name: string
  }): Promise<TranscriptFile | null> {
    try {
      const records = await fullRecords.readRecords(file.path)
      return transcriptFileFrom(file.path, {
        fileName: file.name,
        records: normalizeRecords?.(records) ?? records,
      })
    } catch {
      return null
    }
  }

  async function readChainFiles(chain: SessionChain): Promise<TranscriptFile[]> {
    const paths = chain.files.map((file) => file.path)
    for (const path of paths) discardedFullPaths.delete(path)
    for (const file of chain.files) fullPaths.set(file.sessionId, paths)
    fullPaths.set(chain.id, paths)
    const read = await Promise.all(
      chain.files.map((file) => readFullFile({ path: file.path, name: `${file.sessionId}.jsonl` })),
    )
    if (paths.some((path) => discardedFullPaths.has(path))) fullRecords.clear(paths)
    return read.filter((file): file is TranscriptFile => file !== null)
  }

  function clearFullRecords(sessionId: string) {
    const paths = fullPaths.get(sessionId)
    if (paths === undefined) return
    for (const path of paths) discardedFullPaths.add(path)
    fullRecords.clear(paths)
    for (const [id, remembered] of fullPaths) {
      if (remembered === paths) fullPaths.delete(id)
    }
  }

  return { readChainFiles, clearFullRecords }
}
