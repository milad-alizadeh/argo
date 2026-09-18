// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the CLI writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
} from '@/core/sessions/discover-transcript-sessions'
import { parseTranscriptLine } from './records'

export type Discovery = TranscriptDiscovery

async function transcriptPaths(root: string): Promise<{ path: string; name: string }[]> {
  const directories = await readdir(root, { withFileTypes: true })
  const found: { path: string; name: string }[] = []
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const inside = await readdir(path.join(root, directory.name)).catch(() => [])
    for (const name of inside) {
      if (name.endsWith('.jsonl')) found.push({ path: path.join(root, directory.name, name), name })
    }
  }
  return found
}

const reader = createTranscriptDiscoverer({
  cli: 'claude',
  transcriptPaths,
  parse: parseTranscriptLine,
})

export const {
  clearFullRecords,
  discoverSessions,
  readSessionFiles,
  backfillTick,
  reconcileAll,
  resolveIds,
  historyComplete,
} = reader
