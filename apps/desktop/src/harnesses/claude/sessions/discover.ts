// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the Harness writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { createTranscriptDiscoverer, type TranscriptDiscovery } from '@/domains/sessions/main/port'
import { normalizeClaudeRecords } from '@/harnesses/claude/sessions/normalize-records'
import { parseTranscriptLine } from '@/harnesses/claude/sessions/records'

export type Discovery = TranscriptDiscovery

function sessionIdFromFileName(fileName: string) {
  return fileName.replace(/\.jsonl$/, '')
}

async function transcriptPaths(root: string): Promise<{ path: string; sessionId: string }[]> {
  const directories = await readdir(root, { withFileTypes: true })
  const found: { path: string; sessionId: string }[] = []
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const inside = await readdir(path.join(root, directory.name)).catch(() => [])
    for (const name of inside) {
      if (name.endsWith('.jsonl')) {
        found.push({
          path: path.join(root, directory.name, name),
          sessionId: sessionIdFromFileName(name),
        })
      }
    }
  }
  return found
}

const reader = createTranscriptDiscoverer({
  harness: 'claude',
  transcriptPaths,
  parse: parseTranscriptLine,
  normalizeRecords: normalizeClaudeRecords,
})

export const {
  clearFullRecords,
  discoverSessions,
  readSessionFiles,
  backfillTick,
  reconcileAll,
  resolveIds,
  historyComplete,
  searchIndexed,
} = reader
