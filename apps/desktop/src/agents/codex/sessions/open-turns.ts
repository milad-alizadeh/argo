// Which Codex threads another client is running a Turn in right now (ADR-0040, CONTEXT.md L2 ·
// Session). A rollout marks each Turn's start and end, so a thread whose newest mark is a start,
// in a rollout written to recently, is live elsewhere. Read-only, and read by appends only.
import { stat } from 'node:fs/promises'
import { z } from 'zod'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { sessionIdOfFile } from '@/domains/sessions/contract/model/transcript-file'
import { isLiveElsewhere } from '@/domains/sessions/main/lifecycle/live-elsewhere'
import {
  createTranscriptRecordReader,
  ROSTER_FILE_LIMIT,
} from '@/domains/sessions/main/observation/transcript-lines'
import { hasOpenSubagent } from '@/domains/sessions/main/projection/subagents'
import { transcriptPaths } from './discover'

// The Turn marks codex-cli 0.147.0 writes as `event_msg` payloads.
const TURN_MARK_TYPES = ['task_started', 'task_complete', 'turn_aborted'] as const
type TurnMark = { kind: 'opened' | 'closed' }
const TURN_MARKS: Record<(typeof TURN_MARK_TYPES)[number], TurnMark['kind']> = {
  task_started: 'opened',
  task_complete: 'closed',
  turn_aborted: 'closed',
}

const turnMarkSchema = z.object({
  type: z.literal('event_msg'),
  payload: z.object({ type: z.enum(TURN_MARK_TYPES) }),
})

// Three times the longest silence measured inside a running Codex Turn (10 minutes over 89,725
// gaps, 2026-09): a client that quit or crashed mid-Turn leaves that Turn open for good.
const LIVE_TURN_SILENCE_MS = 30 * 60 * 1000

function parseTurnMark(line: string): TurnMark | null {
  if (!TURN_MARK_TYPES.some((type) => line.includes(`"${type}"`))) return null
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  const parsed = turnMarkSchema.safeParse(value)
  return parsed.success ? { kind: TURN_MARKS[parsed.data.payload.type] } : null
}

async function writtenWithin(file: { path: string }, now: number) {
  const written = await stat(file.path).catch(() => null)
  return written !== null && now - written.mtimeMs < LIVE_TURN_SILENCE_MS
}

// The thread ids whose newest Turn is open in a rollout written within the silence bound.
export function createOpenTurnReader(root: string) {
  const { readRecords } = createTranscriptRecordReader(parseTurnMark, ROSTER_FILE_LIMIT)
  return async (now: number): Promise<ReadonlySet<string>> => {
    const files = await transcriptPaths(root).catch(() => [])
    const recent = await Promise.all(
      files.map(async (file) => ((await writtenWithin(file, now)) ? [file] : [])),
    )
    const open = await Promise.all(
      recent.flat().map(async (file) => {
        const marks = await readRecords(file.path).catch(() => [])
        return marks.at(-1)?.kind === 'opened' ? [sessionIdOfFile(file.name)] : []
      }),
    )
    return new Set(open.flat())
  }
}

export function joinOpenTurns(
  rows: SessionRosterRow[],
  open: ReadonlySet<string>,
): SessionRosterRow[] {
  return rows.map((row) =>
    isLiveElsewhere(row, open) || (row.posture === 'external' && hasOpenSubagent(row.subagents))
      ? { ...row, status: 'running', locked: true }
      : row,
  )
}
