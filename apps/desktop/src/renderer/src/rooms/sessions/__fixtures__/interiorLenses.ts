import { MINUTE, NOW_MS } from './interiorTree'
import { aSubagent, aToolCall, aTurn, aUsage } from './runtimeTree'

// The delegates running beside the session's own turns. Split from `interiorTree.ts` for the line
// ceiling, along the seam the domain already has: a Subagent's work is a DIFFERENT agent's, which is
// the whole reason the Activity surface heads it separately.

// Three spawned a few minutes apart and all still going, so the fanout draws three different
// durations — which is the whole reading a subagent list is scanned for. A queued one is spawned too:
// it has been waiting for a slot, and that wait is a real duration.
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
