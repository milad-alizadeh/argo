// The Marker's label state machine (#2099): Starting Session -> Resuming Session -> Thinking <->
// Working -> gone. A presentation-layer label only (no new Session status), driven off the
// Session's existing posture and per-Turn activity signal, and the client-owned Send that opened
// this Turn optimistically, before any record confirms it.

import type {
  SessionActivity,
  SessionFeedRow,
  SessionPosture,
  SessionStatus,
} from '@/core/sessions/models'

export const TURN_MARKER_STAGES = ['starting', 'resuming', 'live'] as const
export type TurnMarkerStage = (typeof TURN_MARKER_STAGES)[number]

export const TURN_MARKER_PHASES = ['starting', 'resuming', 'thinking', 'working'] as const
export type TurnMarkerPhase = (typeof TURN_MARKER_PHASES)[number]

export type TurnMarkerEntry = {
  stage: TurnMarkerStage
  // The Session's own turnStartedAt at the moment Send was pressed, so the real record catching
  // up (a different value) is the one honest "the CLI has spoken" signal (turn-setup.ts's
  // turnSettled reads the same fact for the same reason).
  since: string | null
  startedAt: number
  prompt: string
}

export type TurnMarkerView = { phase: TurnMarkerPhase; startedAt: number }

export type TurnMarkerRow = {
  turnStartedAt: string | null
  activity: SessionActivity | null
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
  if (hasSettled(entry, row)) return null
  return {
    shape: 'prose',
    id: `optimistic-turn:${entry.startedAt}`,
    role: 'user',
    text: entry.prompt,
  }
}

// The Marker's current label and elapsed-time origin. Starting/Resuming hold until the real
// record catches up; a `live` stage reads Thinking/Working immediately, since the process was
// already there before this Send.
export function turnMarkerView(entry: TurnMarkerEntry, row: TurnMarkerRow | null): TurnMarkerView {
  if (entry.stage !== 'live' && !hasSettled(entry, row)) {
    return { phase: entry.stage, startedAt: entry.startedAt }
  }
  return { phase: row?.activity ? 'working' : 'thinking', startedAt: entry.startedAt }
}

// The Turn is over once the real record has caught up and the Session has left `running`
// (a normal end, a Permission, a question, or an interrupt all read the same way here: the
// Marker's job ends and each state's own UI takes over). Never fires before settling, so a stale
// poll from before Send cannot be read as an already-finished Turn.
export function turnEnded(entry: TurnMarkerEntry, row: TurnMarkerRow | null): boolean {
  return hasSettled(entry, row) && row.status !== 'running'
}
