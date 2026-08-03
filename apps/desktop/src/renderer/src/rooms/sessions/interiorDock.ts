import { isSteerable, openTurn, rootAgent, type SessionView } from '@shared'
import type { PlanProgressModel } from './interiorActivity'

// The Dock's derivation: what the session is doing right now, and whether there is a PTY to steer.
// The now-head lives IN the dock's header row rather than on a strip of its own, so live-process
// state stays visible across both tabs (`cockpit-spec.md` §4.2).

/** A live PTY you type at, or a transcript being replayed with nothing to steer. */
export type DockKind = 'pty' | 'transcript'

export interface NowHeadModel {
  /** What the session is doing right now — the tool call in flight. `null` where nothing is. */
  task: string | null
  /** The agent's own plan, `N/M`. Absent where the CLI reported no plan. */
  plan: Pick<PlanProgressModel, 'done' | 'total'> | null
  /** The last thing it did, for a session at rest. Mutually exclusive with `task` in practice. */
  last: string | null
  /** Whether a turn is open. The header row's dot, and the difference between working and resting. */
  live: boolean
}

export interface DockModel {
  kind: DockKind
  now: NowHeadModel
}

const IDLE_NOW: NowHeadModel = { task: null, plan: null, last: null, live: false }

// What a tool call is called, plus what it names — `Edit rotation.ts` rather than a bare verb. The
// host's own tool name travels verbatim (CONTEXT.md L3), so nothing it said is renamed away.
const describe = (name: string, target: string | null): string =>
  target === null ? name : `${name} ${target}`

/** The now-head. Reads the root Agent's open turn: the call in flight is what it is doing, and the
 * newest closed call is what it last did. */
export function nowHead(session: SessionView): NowHeadModel {
  const root = rootAgent(session.agents)
  if (root === null) return IDLE_NOW
  const open = openTurn(root)
  const calls = root.turns.flatMap((turn) => turn.toolCalls)
  const running = open?.toolCalls.findLast((call) => call.status === 'in_progress') ?? null
  const plan = open?.plan ?? null
  return {
    task: running === null ? null : describe(running.name, running.target),
    plan:
      plan === null
        ? null
        : {
            done: plan.entries.filter((entry) => entry.status === 'completed').length,
            total: plan.entries.length,
          },
    last: running !== null ? null : (calls.at(-1)?.name ?? null),
    live: open !== null,
  }
}

/**
 * The Dock's whole view-model. An external session has no PTY — Argo did not launch it — so the
 * Dock degrades to a transcript replay rather than offering a prompt that could not steer anything.
 */
export function buildDock(session: SessionView): DockModel {
  return {
    kind: isSteerable(session.posture) ? 'pty' : 'transcript',
    now: nowHead(session),
  }
}
