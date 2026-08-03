import type { PlanEntry, SessionView, Turn } from '@shared'
import { rootAgent } from '@shared'

// The Session's live to-do list (ADR-0020). Its own module rather than a corner of the Activity
// surface's: the plan is a fact about the SESSION that two surfaces read — the Activity tracker and
// the Dock's now-head — and a turn no longer carries one at all.

export interface PlanProgressModel {
  done: number
  total: number
  entries: readonly PlanEntry[]
}

/**
 * ONE turn's plan SNAPSHOT — the version in force while it ran.
 *
 * An EMPTIED list reads as absent rather than as `0 of 0`: a cleared plan is not zero progress, and
 * treating it as a snapshot would let it mask the last real one the session reported.
 */
function planSnapshot(turn: Turn): PlanProgressModel | null {
  if (turn.plan === null || turn.plan.entries.length === 0) return null
  const { entries } = turn.plan
  return {
    done: entries.filter((entry) => entry.status === 'completed').length,
    total: entries.length,
    entries,
  }
}

/**
 * The Session's live plan — one list, not one per turn.
 *
 * The agent replaces the whole list, and a Turn carries only the snapshot in force while it ran
 * (ADR-0020) — so the session's plan is the newest snapshot OBSERVED, not the open turn's: a turn
 * that touched no plan must not blank it.
 *
 * DERIVED — the newest version Argo observed, which is not provably the newest that exists.
 */
export function sessionPlan(session: SessionView): PlanProgressModel | null {
  const turns = rootAgent(session.agents)?.turns ?? []
  const newest = turns.findLast((turn) => planSnapshot(turn) !== null)
  return newest === undefined ? null : planSnapshot(newest)
}
