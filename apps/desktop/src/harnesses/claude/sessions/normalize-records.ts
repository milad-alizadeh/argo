import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript'
import { readingBackgroundStops } from '@/harnesses/claude/sessions/background-stop'
import { readingSpawnedAgents } from '@/harnesses/claude/sessions/spawned-agents'

export function normalizeClaudeRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return readingBackgroundStops(readingSpawnedAgents(records))
}
