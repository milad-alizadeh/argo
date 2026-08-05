import { type SessionView, sessionFacts, sessionView } from '@shared'
import { buildSessionInterior, type SessionInteriorModel } from '../interiorModel'
import { NOW_MS } from './interiorTree'
import { lensTurns } from './lensTurns'
import { ago, LONG_TURNS } from './longTurns'
import { aRoot, aSubagent, aUsage } from './runtimeTree'

// FIXTURE. The session the Activity surface is judged against: nine turns over ninety minutes,
// three lens delegates each with a real feed of their own, one compaction, one live turn at the
// bottom, one turn of four screenshots.

const LENS_SPEC = [
  { id: 'perf', label: 'perf lens', ran: 4 },
  { id: 'correctness', label: 'correctness lens', ran: 6 },
  { id: 'security', label: 'security lens', ran: 9 },
]

const LENSES = LENS_SPEC.map((lens) =>
  aSubagent({
    id: lens.id,
    label: lens.label,
    group: 'Verify',
    startedAtMs: ago(40),
    endedAtMs: ago(40 - lens.ran),
    turns: lensTurns(lens.id),
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
