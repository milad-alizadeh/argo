import { type SessionView, sessionFacts, sessionView } from '@shared'
import { buildSessionInterior, type SessionInteriorModel } from '../interior/model'
import type { SubagentGroupModel } from '../interior/subagents'
import { LENSES } from './interiorLenses'
import { MINUTE, NOW_MS, OPEN_TURN, PAST_TURN } from './interiorTree'
import { aRoot, aSubagent, aTurn } from './runtimeTree'

// One populated session the interior's stories all read, so every surface is judged against the
// same world. Typed off `SessionView`, so a change to the projection is a compile error here rather
// than a stale fixture that still renders.

/** A managed session mid-turn, with a fanout running beside it. */
export const RUNNING: SessionView = sessionView({
  id: 'auth',
  title: 'Auth refactor',
  model: 'claude-opus-5',
  branch: 'feat/auth-rotation',
  lastActivityAt: NOW_MS - 3 * MINUTE,
  agents: [
    aRoot({
      turns: [PAST_TURN, OPEN_TURN],
      compactions: [{ beforeTurnId: 'now' }],
      // The same span the observer derives — first turn's start, last turn's end — so the fixture
      // cannot render a duration the real derivation could never produce.
      startedAtMs: PAST_TURN.startedAtMs,
      endedAtMs: OPEN_TURN.endedAtMs,
    }),
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
    aRoot({ turns: [OPEN_TURN], startedAtMs: OPEN_TURN.startedAtMs }),
    ...Array.from({ length: 30 }, (_, index) =>
      aSubagent({
        id: `lens-${index}`,
        label: `lens ${index + 1}`,
        group: 'Verify',
        // Staggered, so the durations down the list differ and the column is read rather than
        // scanned past as thirty copies of one number.
        startedAtMs: NOW_MS - (30 - index) * MINUTE,
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
      aRoot({ turns: [OPEN_TURN], startedAtMs: OPEN_TURN.startedAtMs }),
      ...LENSES.map((lens, index) =>
        aSubagent({
          id: lens.id,
          turns: lens.turns,
          startedAtMs: lens.startedAtMs,
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
    aRoot({ turns: [OPEN_TURN], startedAtMs: OPEN_TURN.startedAtMs }),
    aSubagent({
      id: 'find',
      label: 'find lens',
      group: 'Find',
      startedAtMs: NOW_MS - 14 * MINUTE,
    }),
    ...LENSES,
  ],
})

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
