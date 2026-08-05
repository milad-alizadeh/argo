import { sessionFacts, sessionView } from '@shared'
import { NOW_MS } from '../__fixtures__/interiorTree'
import { aRoot, aToolCall, aTurn, aUsage } from '../__fixtures__/runtimeTree'
import { buildSessionInterior } from '../interiorModel'
import { type Chapter, chapters } from './feedIndex'
import { ago } from './longTurns'
import type { DelegateItem } from './SubagentScope'

// PROTOTYPE FIXTURE. Each lens delegate gets a real two-turn feed of its own, built through the
// SAME interior pipeline as the main session — because the locked rail renders a delegate's scope
// through the same FeedSurface, and a surface can only be judged on real chapters.

interface LensTurn {
  id: string
  at: number
  prompt: string
  said: string
  calls: readonly [string, 'read' | 'search' | 'execute', string | null, string?][]
}

const turnOf = (spec: LensTurn) =>
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

const LENS_FEEDS: Record<string, readonly LensTurn[]> = {
  'perf lens': [
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
  'correctness lens': [
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
  'security lens': [
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

const feedOf = (name: string, turns: readonly LensTurn[]): Chapter[] =>
  chapters(
    buildSessionInterior({
      session: sessionView({
        id: `lens-${name.replaceAll(' ', '-')}`,
        title: name,
        model: 'claude-opus-5',
        branch: 'feat/auth-rotation',
        lastActivityAt: ago(31),
        agents: [aRoot({ turns: turns.map(turnOf), startedAtMs: ago(40), endedAtMs: ago(31) })],
        facts: sessionFacts({}),
      }),
      nowMs: NOW_MS,
      link: { titleSource: 'derived', intent: { number: 42, title: 'Auth flow' }, mode: 'Code' },
    }).activity,
  )

const DELEGATE_CHAPTERS = new Map(
  Object.entries(LENS_FEEDS).map(([name, turns]) => [name, feedOf(name, turns)]),
)

/** A delegate's own chapters, by its name — empty for a delegate the fixture never scripted. */
export const delegateChapters = (item: DelegateItem): readonly Chapter[] =>
  DELEGATE_CHAPTERS.get(item.subagent.name) ?? []
