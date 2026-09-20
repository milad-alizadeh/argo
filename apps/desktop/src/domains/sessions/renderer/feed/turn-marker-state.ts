// The Marker's label state machine (#2099): Starting Session -> Resuming Session -> Working ->
// gone. A presentation-layer label only (no new Session status), driven off the Session's existing
// posture and the client-owned Send that opened this Turn optimistically, before any record
// confirms it.

import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import { attachedImageUrl } from '@/domains/sessions/contract/model/feed-images'
import type {
  SessionFeedRow,
  SessionPosture,
  SessionStatus,
} from '@/domains/sessions/contract/model/models'

export const TURN_MARKER_STAGES = ['starting', 'resuming', 'live'] as const
export type TurnMarkerStage = (typeof TURN_MARKER_STAGES)[number]

export const TURN_MARKER_PHASES = ['starting', 'resuming', 'working'] as const
export type TurnMarkerPhase = (typeof TURN_MARKER_PHASES)[number]

export type TurnMarkerEntry = {
  stage: TurnMarkerStage
  // The Session's own turnStartedAt at the moment Send was pressed, so the real record catching
  // up (a different value) is the one honest "the CLI has spoken" signal (turn-setup.ts's
  // turnSettled reads the same fact for the same reason).
  since: string | null
  startedAt: number
  prompt: string
  images: readonly string[]
  files: readonly string[]
}

// What the optimistic bubble draws of a Send: its words, its attached images and its other files.
export function promptOf(turn: {
  prompt: string
  attachments: readonly SessionAttachmentInput[]
}): Pick<TurnMarkerEntry, 'prompt' | 'images' | 'files'> {
  const images: string[] = []
  const files: string[] = []
  for (const { path } of turn.attachments) {
    const image = attachedImageUrl(path)
    if (image === null) files.push(path)
    else images.push(image)
  }
  return { prompt: turn.prompt, images, files }
}

export type TurnMarkerView = { phase: TurnMarkerPhase; startedAt: number }

export type TurnMarkerRow = {
  turnStartedAt: string | null
  status: SessionStatus
}

// Starting vs. Resuming is chosen once, at Send time, by whether this Session's process has ever
// run under Argo before: a brand-new Session (no id yet) starts, one currently external (never
// driven, or Argo held it and lost it across a restart, CONTEXT.md L2 · Session) resumes. One
// already managed has necessarily spoken before (`starting` is unreachable once a managed Session
// has said anything, docs/domain/l2-session.md), so it skips straight to reading activity.
export function stageFor(
  identityKind: 'draft' | 'session',
  posture: SessionPosture | null,
): TurnMarkerStage {
  if (identityKind === 'draft') return 'starting'
  return posture === 'managed' ? 'live' : 'resuming'
}

// Whether the real record for this Turn has caught up: the Session moved off the turnStartedAt
// this Send began against. Nothing here is guessed from a clock or a round-trip resolving; the
// transcript is the one honest witness (CONTEXT.md L1 · degrade down).
function hasSettled(entry: TurnMarkerEntry, row: TurnMarkerRow | null): row is TurnMarkerRow {
  return row !== null && row.turnStartedAt !== entry.since
}

// The optimistic prompt row: shown until the real record for this Turn appears, then retired
// (matched by turnStartedAt catching up, not by a new matching mechanism).
export function optimisticRowFor(
  entry: TurnMarkerEntry,
  row: TurnMarkerRow | null,
): SessionFeedRow | null {
  return hasSettled(entry, row) ? null : promptRowFor(entry)
}

// The same row once the roster has settled: the transcript may not hold the prompt yet (#2430).
export function settledPromptRowFor(
  entry: TurnMarkerEntry,
  row: TurnMarkerRow | null,
): SessionFeedRow | null {
  return hasSettled(entry, row) ? promptRowFor(entry) : null
}

function promptRowFor(entry: TurnMarkerEntry): SessionFeedRow {
  return {
    shape: 'prose',
    id: `optimistic-turn:${entry.startedAt}`,
    role: 'user',
    text: entry.prompt,
    ...(entry.images.length > 0 ? { images: [...entry.images] } : {}),
    ...(entry.files.length > 0 ? { files: [...entry.files] } : {}),
  }
}

// The Marker's current label and elapsed-time origin. Starting/Resuming hold until the real
// record catches up; a `live` stage reads Working immediately, since the process was already
// there before this Send.
export function turnMarkerView(entry: TurnMarkerEntry, row: TurnMarkerRow | null): TurnMarkerView {
  if (entry.stage !== 'live' && !hasSettled(entry, row)) {
    return { phase: entry.stage, startedAt: entry.startedAt }
  }
  return { phase: 'working', startedAt: entry.startedAt }
}

// A Turn no Send here opened, such as one typed into the CLI itself, still reads Working while the
// Session runs, timed from the Turn's own start.
export function runningTurnView(row: TurnMarkerRow | null): TurnMarkerView | null {
  if (row?.status !== 'running' || row.turnStartedAt === null) return null
  const startedAt = Date.parse(row.turnStartedAt)
  return Number.isNaN(startedAt) ? null : { phase: 'working', startedAt }
}

// The Turn is over once the real record has caught up and the Session has left `running`
// (a normal end, a Permission, a question, or an interrupt all read the same way here: the
// Marker's job ends and each state's own UI takes over). Never fires before settling, so a stale
// poll from before Send cannot be read as an already-finished Turn.
export function turnEnded(entry: TurnMarkerEntry, row: TurnMarkerRow | null): boolean {
  return hasSettled(entry, row) && row.status !== 'running'
}
