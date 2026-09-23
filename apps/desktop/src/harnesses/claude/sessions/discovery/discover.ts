// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the Harness writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
} from '@/domains/sessions/main/observation/reader/discover-transcript-sessions'
import { transcriptPaths } from '../../transcript-files'
import { parseTranscriptLine } from '../records/records'
import { normalizeClaudeRecords } from './normalize-records'

export type Discovery = TranscriptDiscovery

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
