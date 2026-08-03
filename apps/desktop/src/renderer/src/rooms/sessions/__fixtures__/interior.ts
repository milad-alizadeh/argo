import { type SessionView, sessionFacts, sessionView } from '@shared'
import { buildSessionInterior, type SessionInteriorModel } from '../interiorModel'
import type { SubagentGroupModel } from '../interiorSubagents'
import { aRoot, aSubagent, aToolCall, aTurn, aUsage, namedPlan } from './runtimeTree'

// One populated session the interior's stories all read, so every surface is judged against the
// same world. Typed off `SessionView`, so a change to the projection is a compile error here rather
// than a stale fixture that still renders.

const CONTEXT_USED = aUsage({ inputTokens: 26_000, cacheReadTokens: 50_000 })

const OPEN_TURN = aTurn({
  id: 'now',
  stopReason: null,
  usage: CONTEXT_USED,
  // Real plan prose, not `step N`: a placeholder entry hides exactly what these surfaces are for —
  // whether an agent's own to-do list reads as work at a glance.
  plan: {
    entries: namedPlan([
      ['completed', 'Read the legacy auth module'],
      ['completed', 'Extract the rotation core'],
      ['in_progress', 'Wire verify() onto it'],
      ['pending', 'Add middleware tests'],
    ]),
  },
  toolCalls: [
    aToolCall({ id: 'c1', name: 'Read', target: 'src/auth/legacy.ts' }),
    aToolCall({ id: 'c2', name: 'Edit', kind: 'edit', target: 'src/auth/rotation.ts' }),
    aToolCall({
      id: 'c3',
      name: 'Bash',
      kind: 'execute',
      status: 'in_progress',
      target: 'bun run typecheck',
    }),
    aToolCall({ id: 'c4', name: 'Grep', kind: 'search', status: 'pending', target: 'verify(' }),
  ],
})

const PAST_TURN = aTurn({
  id: 'past',
  toolCalls: [
    aToolCall({ id: 'p1', name: 'Read', target: 'src/auth/token.ts' }),
    aToolCall({ id: 'p2', name: 'Write', kind: 'edit', status: 'failed', target: 'src/auth/x.ts' }),
  ],
})

const LENSES = [
  aSubagent({
    id: 'correctness',
    label: 'correctness lens',
    group: 'Verify',
    turns: [
      aTurn({
        id: 'v1',
        stopReason: null,
        toolCalls: [aToolCall({ id: 'v1c', name: 'Read', target: 'rotation.ts' })],
      }),
    ],
  }),
  aSubagent({
    id: 'security',
    label: 'security lens',
    group: 'Verify',
    turns: [aTurn({ id: 'v2', stopReason: null, toolCalls: [] })],
  }),
  aSubagent({ id: 'repro', label: 'repro lens', group: 'Verify' }),
]

/** A managed session mid-turn, with a fanout running beside it. */
export const RUNNING: SessionView = sessionView({
  id: 'auth',
  title: 'Auth refactor',
  model: 'claude-opus-5',
  branch: 'feat/auth-rotation',
  lastActivityAt: 0,
  agents: [
    aRoot({ turns: [PAST_TURN, OPEN_TURN], compactions: [{ beforeTurnId: 'now' }] }),
    ...LENSES,
  ],
  facts: sessionFacts({ dirty: 3, unpushed: 2 }),
})

/** A session Argo only observes: no ring, no intent, no PTY to steer. */
export const EXTERNAL: SessionView = sessionView({
  id: 'watched',
  title: '~/argo · explore join drift',
  posture: 'external',
  cwd: '/Users/dev/argo',
  model: 'claude-sonnet-5',
  lastActivityAt: 0,
  facts: sessionFacts({ status: 'idle' }),
})

/** Freshly spawned: nothing observed yet, so the Dock is home. */
export const FRESH: SessionView = sessionView({
  id: 'new',
  title: 'New session',
  model: 'claude-opus-5',
  agents: [aRoot()],
})

/** Thirty subagents in one group — the fanout the dense row list has to stay scannable under. */
export const WIDE_FANOUT: SessionView = sessionView({
  ...RUNNING,
  agents: [
    aRoot({ turns: [OPEN_TURN] }),
    ...Array.from({ length: 30 }, (_, index) =>
      aSubagent({
        id: `lens-${index}`,
        label: `lens ${index + 1}`,
        group: 'Verify',
        turns: index < 12 ? [aTurn({ id: `t-${index}`, stopReason: null })] : [],
      }),
    ),
  ],
})

// The lower two blueprint tiers, as REAL trees rather than a phased model with its fields blanked:
// the tier is read off what the subagents carry, so a fixture that contradicts itself would let a
// story pass on a model the derivation can never produce.
const withoutPhases = (labelled: boolean): SessionView =>
  sessionView({
    ...RUNNING,
    agents: [
      aRoot({ turns: [OPEN_TURN] }),
      ...LENSES.map((lens, index) =>
        aSubagent({
          id: lens.id,
          turns: lens.turns,
          ...(labelled ? { label: `lens ${index + 1}` } : {}),
        }),
      ),
    ],
  })

/** A labelled tree — Codex's tier: the subagents name themselves but report no phase. */
export const LABELLED_FANOUT: SessionView = withoutPhases(true)

/** A bare CLI: no names, no phases, nothing but a count. */
export const FLAT_FANOUT: SessionView = withoutPhases(false)

/** A phased blueprint whose subagents sit in TWO phases — the case a single group name would
 * misreport, since most of these rows belong to the phase the header would not be naming. */
export const MIXED_PHASES: SessionView = sessionView({
  ...RUNNING,
  agents: [
    aRoot({ turns: [OPEN_TURN] }),
    aSubagent({ id: 'find', label: 'find lens', group: 'Find' }),
    ...LENSES,
  ],
})

const NOW_MS = 8 * 60_000

export const interiorOf = (session: SessionView): SessionInteriorModel =>
  buildSessionInterior({ session, nowMs: NOW_MS })

/** The fanout group of a fixture that has one, narrowed here so no story needs an assertion. */
export function groupOf(session: SessionView): SubagentGroupModel {
  const group = interiorOf(session).activity.subagents
  if (group === null) throw new Error('this fixture spawned no subagents')
  return group
}

export const withIntent = (session: SessionView): SessionInteriorModel =>
  buildSessionInterior({
    session,
    nowMs: NOW_MS,
    link: { titleSource: 'derived', intent: { number: 42, title: 'Auth flow' }, mode: 'Code' },
  })
