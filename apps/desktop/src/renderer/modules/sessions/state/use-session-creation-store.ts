import { create } from 'zustand'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { SessionCli } from '../harness/harnesses'

// A tempId names the Roster row before the backend has ever heard of it, so a reader can tell it
// apart from a real Session id on sight (`isOptimisticSessionId`).
const TEMP_ID_PREFIX = 'optimistic:'

export function isOptimisticSessionId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX)
}

// An optimistic row has no backend record yet: a caller that would otherwise ask the backend for
// one by id (a feed read, a permission or question poll) asks for this instead, and waits.
export function readableSessionId(id: string | null): string | null {
  return id !== null && !isOptimisticSessionId(id) ? id : null
}

// `draft`: no `session.start` call fired yet, `id` is the tempId. `reconciling`: `start` answered
// with a real Session id, `id` becomes that real id, and the row stays synthetic until the Roster
// reader reports it for real (CONTEXT.md L2 · Session, `starting` status).
export type PendingSession =
  | {
      stage: 'draft'
      id: string
      cli: SessionCli
      cwd: string
      submitting: boolean
      prompt: string | null
    }
  | { stage: 'reconciling'; id: string; cli: SessionCli; cwd: string; prompt: string | null }

type SessionCreationState = {
  pending: PendingSession | null
  // Idempotent: a second activation while one is already pending returns the same row rather than
  // starting a second one (#2109).
  begin: (cli: SessionCli, cwd: string) => PendingSession
  // Claims the one `start` submission for a draft row. Returns false when a submission for it is
  // already in flight, which is the dedup signal a caller no-ops on.
  startSubmission: (id: string, prompt: string) => boolean
  // The `start` call answered with a real Session id: the row now displays under that id.
  resolved: (id: string, realId: string) => void
  // The `start` call failed: the row is gone, never a lingering `starting` ghost.
  failed: (id: string) => void
  // The Roster reader reported the real Session for itself: the synthetic row is no longer needed.
  confirmed: (realId: string) => void
  // The person moved on without sending anything on this draft row.
  abandon: (id: string) => void
}

// The prompt's first line names the row until a ranked title replaces it (core/sessions/roster.ts readTitle).
function promptTitle(prompt: string): string | null {
  const line = prompt.split('\n').find((candidate) => candidate.trim() !== '')
  return line === undefined ? null : line.trim()
}

export const useSessionCreationStore = create<SessionCreationState>()((set, get) => ({
  pending: null,
  begin: (cli, cwd) => {
    const existing = get().pending
    if (existing !== null) return existing
    const created: PendingSession = {
      stage: 'draft',
      id: `${TEMP_ID_PREFIX}${crypto.randomUUID()}`,
      cli,
      cwd,
      submitting: false,
      prompt: null,
    }
    set({ pending: created })
    return created
  },
  startSubmission: (id, prompt) => {
    const current = get().pending
    if (current === null || current.stage !== 'draft' || current.id !== id || current.submitting) {
      return false
    }
    set({ pending: { ...current, submitting: true, prompt: promptTitle(prompt) } })
    return true
  },
  resolved: (id, realId) => {
    const current = get().pending
    if (current === null || current.id !== id) return
    set({
      pending: {
        stage: 'reconciling',
        id: realId,
        cli: current.cli,
        cwd: current.cwd,
        prompt: current.prompt,
      },
    })
  },
  failed: (id) => {
    if (get().pending?.id === id) set({ pending: null })
  },
  confirmed: (realId) => {
    const current = get().pending
    if (current?.stage === 'reconciling' && current.id === realId) set({ pending: null })
  },
  abandon: (id) => {
    if (get().pending?.stage === 'draft' && get().pending?.id === id) set({ pending: null })
  },
}))

// Puts the optimistic row at the top of a real Roster read (a new Session is the newest), in place of the real Session until the reader
// reports it: never a second entry once that id shows up for real (#2109).
export function mergeOptimisticRow(
  sessions: SessionRosterRow[],
  pending: PendingSession | null,
): SessionRosterRow[] {
  if (pending === null) return sessions
  if (sessions.some((session) => session.id === pending.id)) return sessions
  return [optimisticSessionRow(pending), ...sessions]
}

// The "+" action's own dedup: a repeat activation while one row is already pending refocuses it
// rather than starting a second Session (#2109 AC: N rapid clicks still produce exactly one).
// `cwd` is the last-used Project's path; with none open yet there is nothing to create on.
export function newSessionTarget(cli: SessionCli, cwd: string | null): string | null {
  const existing = useSessionCreationStore.getState().pending
  if (existing !== null) return existing.id
  if (cwd === null) return null
  return useSessionCreationStore.getState().begin(cli, cwd).id
}

// The Roster row a pending Session renders as, until the reader reports its real one. Every field
// a fresh, untouched Session would carry: no title, no activity, no work.
export function optimisticSessionRow(pending: PendingSession): SessionRosterRow {
  return {
    id: pending.id,
    retiredIds: [],
    cli: pending.cli,
    posture: 'managed',
    title: pending.prompt === null ? null : { text: pending.prompt, source: 'first-prompt' },
    ticket: null,
    status: 'starting',
    entry: 'interactive',
    cwd: pending.cwd,
    branch: null,
    updatedAt: null,
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: null,
    activity: null,
    plan: null,
    delegations: [],
    shell: [],
    pullRequest: null,
    archived: false,
    setup: { model: null, effort: null, mode: null },
  }
}
