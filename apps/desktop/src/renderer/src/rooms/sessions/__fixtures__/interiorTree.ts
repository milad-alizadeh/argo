import { aSubagent, aToolCall, aTurn, aUsage, namedPlan } from './runtimeTree'

// The runtime tree the interior's fixtures are built from: one finished exchange, one still open,
// and the delegates running beside them. Its own module so `interior.ts` reads as the list of
// SESSIONS it exports rather than as the tree they happen to share.

// The wall clock every fixture is read against. Declared here so a time can be written as a
// distance back from it rather than as a bare number nothing explains.
export const NOW_MS = 8 * 60 * 60_000
export const MINUTE = 60_000

const CONTEXT_USED = aUsage({ inputTokens: 26_000, cacheReadTokens: 50_000 })

export const OPEN_TURN = aTurn({
  id: 'now',
  stopReason: null,
  startedAtMs: NOW_MS - 12 * MINUTE,
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
  // The calls carry real clock times a few minutes apart, and the running one has no end — which is
  // what makes its duration grow against the wall clock rather than sit at a fixed number. The
  // queued call has no time at all: it has not happened yet, and a time on it would be invented.
  toolCalls: [
    aToolCall({
      id: 'c1',
      name: 'Read',
      target: 'src/auth/legacy.ts',
      atMs: NOW_MS - 12 * MINUTE,
      endedAtMs: NOW_MS - 12 * MINUTE + 2_000,
    }),
    aToolCall({
      id: 'c2',
      name: 'Edit',
      kind: 'edit',
      target: 'src/auth/rotation.ts',
      atMs: NOW_MS - 9 * MINUTE,
      endedAtMs: NOW_MS - 8 * MINUTE,
    }),
    aToolCall({
      id: 'c3',
      name: 'Bash',
      kind: 'execute',
      status: 'in_progress',
      target: 'bun run typecheck',
      atMs: NOW_MS - 4 * MINUTE,
    }),
    aToolCall({ id: 'c4', name: 'Grep', kind: 'search', status: 'pending', target: 'verify(' }),
  ],
})

// The session's first exchange, finished. Its start is where the whole session's duration is
// measured from; the OPEN turn deliberately keeps `endedAtMs: null`, which is what leaves the
// session's own span open and running.
export const PAST_TURN = aTurn({
  id: 'past',
  startedAtMs: NOW_MS - 50 * MINUTE,
  endedAtMs: NOW_MS - 42 * MINUTE,
  toolCalls: [
    aToolCall({
      id: 'p1',
      name: 'Read',
      target: 'src/auth/token.ts',
      atMs: NOW_MS - 50 * MINUTE,
      endedAtMs: NOW_MS - 49 * MINUTE,
    }),
    aToolCall({
      id: 'p2',
      name: 'Write',
      kind: 'edit',
      status: 'failed',
      target: 'src/auth/x.ts',
      atMs: NOW_MS - 45 * MINUTE,
      endedAtMs: NOW_MS - 44 * MINUTE,
    }),
  ],
})

// Three delegates spawned a few minutes apart and all still going, so the fanout draws three
// different durations — which is the whole reading a subagent list is scanned for. A queued one is
// spawned too: it has been waiting for a slot, and that wait is a real duration.
export const LENSES = [
  aSubagent({
    id: 'correctness',
    label: 'correctness lens',
    group: 'Verify',
    startedAtMs: NOW_MS - 11 * MINUTE,
    turns: [
      aTurn({
        id: 'v1',
        stopReason: null,
        toolCalls: [
          aToolCall({
            id: 'v1c',
            name: 'Read',
            target: 'rotation.ts',
            atMs: NOW_MS - 10 * MINUTE,
            endedAtMs: NOW_MS - 10 * MINUTE + 3_000,
          }),
        ],
      }),
    ],
  }),
  aSubagent({
    id: 'security',
    label: 'security lens',
    group: 'Verify',
    startedAtMs: NOW_MS - 6 * MINUTE,
    turns: [aTurn({ id: 'v2', stopReason: null, toolCalls: [] })],
  }),
  aSubagent({
    id: 'repro',
    label: 'repro lens',
    group: 'Verify',
    startedAtMs: NOW_MS - 2 * MINUTE,
  }),
  // The one that FINISHED, and the only one with a spend: a delegate's tokens arrive with its
  // result, so a running row honestly shows none.
  aSubagent({
    id: 'perf',
    label: 'perf lens',
    group: 'Verify',
    startedAtMs: NOW_MS - 20 * MINUTE,
    endedAtMs: NOW_MS - 16 * MINUTE,
    usage: aUsage({
      inputTokens: 2,
      outputTokens: 3_610,
      cacheReadTokens: 82_107,
      cacheCreationTokens: 549,
    }),
    turns: [aTurn({ id: 'v3' })],
  }),
]
