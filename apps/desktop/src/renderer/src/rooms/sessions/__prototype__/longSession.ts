import { type SessionView, sessionFacts, sessionView } from '@shared'
import { NOW_MS } from '../__fixtures__/interiorTree'
import { aRoot, aSubagent, aToolCall, aTurn, aUsage } from '../__fixtures__/runtimeTree'
import { buildSessionInterior, type SessionInteriorModel } from '../interiorModel'
import { ago, LONG_TURNS } from './longTurns'

// PROTOTYPE FIXTURE. The session the four variants are all judged against: eight turns, three
// delegates, one compaction, one live turn at the bottom. The turns themselves are `longTurns.ts`.

const LENS_SPEC = [
  { id: 'perf', label: 'perf lens', ran: 4 },
  { id: 'correctness', label: 'correctness lens', ran: 6 },
  { id: 'security', label: 'security lens', ran: 9 },
]

const lensReads = (id: string) =>
  ['src/auth/rotation.ts', 'test/auth/rotation.test.ts'].map((target, index) =>
    aToolCall({
      id: `${id}-r${index}`,
      name: 'Read',
      target,
      atMs: ago(40) + index * 20_000,
      endedAtMs: ago(40) + index * 20_000 + 8_000,
    }),
  )

const LENSES = LENS_SPEC.map((lens) =>
  aSubagent({
    id: lens.id,
    label: lens.label,
    group: 'Verify',
    startedAtMs: ago(40),
    endedAtMs: ago(40 - lens.ran),
    turns: [aTurn({ id: `${lens.id}-t`, toolCalls: lensReads(lens.id) })],
    usage: aUsage({ inputTokens: 40_000, outputTokens: 3_000 }),
  }),
)

export const LONG_SESSION: SessionView = sessionView({
  id: 'auth',
  title: 'Auth refactor',
  model: 'claude-opus-5',
  branch: 'feat/auth-rotation',
  lastActivityAt: ago(3),
  agents: [
    aRoot({
      turns: [...LONG_TURNS],
      compactions: [{ beforeTurnId: 'p6' }],
      startedAtMs: ago(92),
      endedAtMs: null,
    }),
    ...LENSES,
  ],
  facts: sessionFacts({ dirty: 3, unpushed: 2 }),
})

export const LONG_INTERIOR: SessionInteriorModel = buildSessionInterior({
  session: LONG_SESSION,
  nowMs: NOW_MS,
  link: { titleSource: 'derived', intent: { number: 42, title: 'Auth flow' }, mode: 'Code' },
})
