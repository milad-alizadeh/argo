import type { TranscriptRecord } from '../../../domains/sessions/contract/transcript'
import { readingBackgroundStops } from './background-stop'
import { readingSpawnedAgents } from './spawned-agents'

export function normalizeClaudeRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return readingBackgroundStops(readingSpawnedAgents(records))
}
