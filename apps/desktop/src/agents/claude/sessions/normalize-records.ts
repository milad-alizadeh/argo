import { readingBackgroundStops } from '@/agents/claude/sessions/background-stop'
import { readingSpawnedAgents } from '@/agents/claude/sessions/spawned-agents'
import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'

export function normalizeClaudeRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return readingBackgroundStops(readingSpawnedAgents(records))
}
