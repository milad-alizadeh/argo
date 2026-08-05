import type { Turn } from '@shared'
import { MINUTE, NOW_MS } from './interiorTree'
import { aMediaResult, aShotOf, SHOT_STAGES } from './media'
import { aToolCall, aTurn, aUsage } from './runtimeTree'

// FIXTURE. A turn that came back with FOUR screenshots in a row — the case a full-width
// image row buries and a thumbnail strip is for. Its own module because `longTurns.ts` is at the
// file ceiling and media calls do not fit its `CallSpec` shape anyway.

const at = (index: number): number => NOW_MS - 20 * MINUTE + index * 15_000

export const SHOTS_TURN: Turn = aTurn({
  id: 'p8',
  startedAtMs: at(0),
  endedAtMs: NOW_MS - 16 * MINUTE,
  prompt: 'Screenshot the four states of the session header before and after the change.',
  prose: [
    {
      kind: 'message',
      markdown:
        'Four states captured: running and idle, each before and after. The idle-after one is the regression — the ring loses its track.',
    },
  ],
  toolCalls: (['running-before', 'running-after', 'idle-before', 'idle-after'] as const).map(
    (state, index) =>
      aToolCall({
        id: `p8-s${index}`,
        name: 'Read',
        target: `/tmp/argo-shots/header-${state}.png`,
        atMs: at(index),
        endedAtMs: at(index) + 2_000,
        result: aMediaResult({
          bytes: aShotOf(state, SHOT_STAGES[index % SHOT_STAGES.length]),
        }),
      }),
  ),
  usage: aUsage({ inputTokens: 30_000, outputTokens: 800 }),
})
