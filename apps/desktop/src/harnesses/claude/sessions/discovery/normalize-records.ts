import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript/transcript'
import { readingBackgroundStops } from '@/harnesses/claude/sessions/subagents/background-stop'
import { readingSpawnedAgents } from '@/harnesses/claude/sessions/subagents/spawned-agents'

export function normalizeClaudeRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return readingBackgroundStops(readingSpawnedAgents(records))
}
