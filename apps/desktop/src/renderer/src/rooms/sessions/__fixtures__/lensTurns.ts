import type { Turn } from '@shared'
import { ago } from './longTurns'
import { aToolCall, aTurn, aUsage } from './runtimeTree'

// FIXTURE. Each lens delegate's own two-turn feed: the delegate scope renders through the same
// FeedSurface as the session, and a surface can only be judged on real chapters — prompts, prose
// and calls, not bare tool lists.

interface LensTurn {
  id: string
  at: number
  prompt: string
  said: string
  calls: readonly [string, 'read' | 'search' | 'execute', string | null, string?][]
}

const turnOf = (spec: LensTurn): Turn =>
  aTurn({
    id: spec.id,
    startedAtMs: ago(spec.at),
    endedAtMs: ago(spec.at - 3),
    prompt: spec.prompt,
    prose: [{ kind: 'message', markdown: spec.said }],
    toolCalls: spec.calls.map(([name, kind, target, output], index) =>
      aToolCall({
        id: `${spec.id}-c${index}`,
        name,
        kind,
        target,
        atMs: ago(spec.at) + index * 20_000,
        endedAtMs: ago(spec.at) + index * 20_000 + 8_000,
        result: output === undefined ? null : { kind: 'output', tier: 'direct', text: output },
      }),
    ),
    usage: aUsage({ inputTokens: 12_000, outputTokens: 900 }),
  })

const FEEDS: Record<string, readonly LensTurn[]> = {
  perf: [
    {
      id: 'perf-t1',
      at: 40,
      prompt: 'Profile the rotation extraction against main. Report regressions only.',
      said: 'No measurable movement: `verify()` p50 is 41µs on both sides. The extraction is pure code motion.',
      calls: [
        ['Read', 'read', 'src/auth/rotation.ts'],
        ['Bash', 'execute', 'bun run bench', 'verify p50 41µs · p99 96µs (±1%)'],
      ],
    },
    {
      id: 'perf-t2',
      at: 37,
      prompt: 'Check allocation counts on the hot path too.',
      said: 'Same story — one allocation per call before and after. Nothing to flag.',
      calls: [['Bash', 'execute', 'bun run bench --alloc', '1 alloc/op, unchanged']],
    },
  ],
  correctness: [
    {
      id: 'correctness-t1',
      at: 40,
      prompt: 'Read the extracted module for behavioural drift from legacy.ts.',
      said: 'One risk: the barrel re-exports both names, and `rotation.ts` imports the barrel for `nextKey` — a cycle once anything in the barrel imports rotation back.',
      calls: [
        ['Read', 'read', 'src/auth/rotation.ts'],
        ['Read', 'read', 'src/auth/index.ts'],
      ],
    },
    {
      id: 'correctness-t2',
      at: 34,
      prompt: 'Is the cycle live today or only latent?',
      said: 'Latent. Nothing in the barrel imports rotation back yet, so it dies with the barrel when the two direct importers move.',
      calls: [['Grep', 'search', 'from ./rotation']],
    },
  ],
  security: [
    {
      id: 'security-t1',
      at: 40,
      prompt: 'Audit the new public surface of rotation.ts.',
      said: '`current()` returns the LIVE `#keys` array — a caller can mutate the ring. Copy on read.',
      calls: [
        ['Read', 'read', 'src/auth/rotation.ts'],
        ['Grep', 'search', 'current\\('],
      ],
    },
    {
      id: 'security-t2',
      at: 31,
      prompt: 'Any other paths that leak module state?',
      said: 'No. `verify()` takes the rotation as an argument now, and nothing else exports state.',
      calls: [['Read', 'read', 'src/auth/verify.ts']],
    },
  ],
}

/** The lens's turns by its id, or an empty feed for a lens the fixture never scripted. */
export const lensTurns = (id: string): Turn[] => (FEEDS[id] ?? []).map(turnOf)
