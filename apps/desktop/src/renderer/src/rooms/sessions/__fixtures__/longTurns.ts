import type { ToolCall, ToolCallKind, ToolCallStatus, Turn } from '@shared'
import { aDiff } from './diff'
import { MINUTE, NOW_MS, OPEN_TURN } from './interiorTree'
import { aToolCall, aTurn, aUsage } from './runtimeTree'
import { SHOTS_TURN } from './shotsTurn'

// FIXTURE. Eight turns over ninety minutes — the shipped `RUNNING` session has two, and two
// is exactly the length at which every navigation idea looks fine.
//
// Written as a SPEC the expanders below inflate, rather than as eight hand-spelled `aTurn` calls: the
// prose is the part worth reading in a fixture the surfaces are judged from, and boilerplate around
// it buries the thing being reviewed.

export const ago = (minutes: number): number => NOW_MS - minutes * MINUTE

/** `[name, kind, target, result]` — `'diff'` for a patch, any other string for printed output. */
type CallSpec = [string, ToolCallKind, string | null, string?]

interface Exchange {
  id: string
  at: number
  ran: number
  prompt: string
  said: string
  calls?: readonly CallSpec[]
  /** Which of the calls failed, by index. A failure is loud in the feed, so the fixture needs one. */
  failed?: number
}

const resultOf = (result: string | undefined): ToolCall['result'] => {
  if (result === undefined) return null
  return result === 'diff' ? aDiff() : { kind: 'output', tier: 'direct', text: result }
}

function call(spec: CallSpec, turn: Exchange, index: number): ToolCall {
  const status: ToolCallStatus = turn.failed === index ? 'failed' : 'completed'
  const at = ago(turn.at) + index * 30_000
  const [name, kind, target, result] = spec
  return aToolCall({
    id: `${turn.id}-c${index}`,
    name,
    kind,
    target,
    status,
    atMs: at,
    endedAtMs: at + 20_000,
    result: resultOf(result),
  })
}

const turnOf = (spec: Exchange): Turn =>
  aTurn({
    id: spec.id,
    startedAtMs: ago(spec.at),
    endedAtMs: ago(spec.at - spec.ran),
    prompt: spec.prompt,
    prose: [{ kind: 'message', markdown: spec.said }],
    toolCalls: (spec.calls ?? []).map((one, index) => call(one, spec, index)),
    usage: aUsage({ inputTokens: 9_000, outputTokens: 1_200 }),
  })

const SPEC: readonly Exchange[] = [
  {
    id: 'p1',
    at: 92,
    ran: 4,
    prompt: 'Where does the auth token get refreshed?',
    said: 'In `token.ts`, on every request through the middleware — there is no scheduled refresh. Two callers bypass the middleware entirely and read the key off the module, which is the bug you are chasing.',
    calls: [
      ['Read', 'read', 'src/auth/token.ts'],
      ['Read', 'read', 'src/auth/middleware.ts'],
    ],
  },
  {
    id: 'p2',
    at: 85,
    ran: 6,
    prompt: 'Map every caller of rotate() and tell me which ones would break if it moved.',
    said: 'Eleven callers. Nine go through the barrel and would not notice a move. Two reach into `legacy.ts` directly:\n\n- `src/api/session.ts` — imports `rotate` by path\n- `test/auth/rotation.test.ts` — imports the module-level `#keys` array\n\nThe test is the harder one: it asserts on private state, so moving the module means rewriting the assertion rather than the import.',
    calls: [
      ['Grep', 'search', 'rotate\\('],
      ['Read', 'read', 'src/api/session.ts'],
      ['Read', 'read', 'test/auth/rotation.test.ts'],
    ],
  },
  {
    id: 'p3',
    at: 74,
    ran: 3,
    prompt: 'Write the interface down before you touch anything.',
    said: 'Written to `docs/auth-rotation.md`. The shape is `Rotation` owning the key ring, and `verify(token, rotation)` taking it as an argument rather than reaching for module state.',
    calls: [['Write', 'edit', 'docs/auth-rotation.md', 'diff']],
  },
  {
    id: 'p4',
    at: 66,
    ran: 5,
    prompt: 'Now extract it.',
    said: 'Extracted. The barrel still re-exports both names, so nothing downstream has changed yet.',
    calls: [
      ['Edit', 'edit', 'src/auth/rotation.ts', 'diff'],
      ['Write', 'edit', 'src/auth/x.ts', "EACCES: permission denied, open 'src/auth/x.ts'"],
    ],
    failed: 1,
  },
  {
    id: 'p5',
    at: 52,
    ran: 7,
    prompt: 'Run the suite and fix whatever the extraction broke.',
    said: 'Four failures, all in `rotation.test.ts`, all the same cause: the test read `#keys` off the module. Rewrote them against the public `current()` instead, which is the assertion that should have been there.',
    calls: [
      ['Bash', 'execute', 'bun run test', '  8 pass\n  4 fail'],
      ['Read', 'read', 'test/auth/rotation.test.ts'],
      ['Edit', 'edit', 'test/auth/rotation.test.ts', 'diff'],
    ],
  },
  {
    id: 'p6',
    at: 40,
    ran: 9,
    prompt: 'Send three lenses over the diff before I look at it.',
    said: 'Three came back. The perf lens found nothing. The correctness lens flagged the barrel re-export as a cycle risk. The security lens flagged that `current()` now returns the live array rather than a copy.',
    calls: [
      ['Agent', 'delegate', 'perf lens'],
      ['Agent', 'delegate', 'correctness lens'],
      ['Agent', 'delegate', 'security lens'],
    ],
  },
  {
    id: 'p7',
    at: 26,
    ran: 4,
    prompt: 'Take the security one. Copy on read.',
    said: '`current()` returns a copy now. The correctness one I left: the barrel cycle is real but it dies with the barrel, and the barrel dies when the two direct importers move.',
    calls: [
      ['Edit', 'edit', 'src/auth/rotation.ts', 'diff'],
      ['Bash', 'execute', 'bun run test', '  12 pass\n  0 fail'],
    ],
  },
]

/** The nine turns, oldest first. The last is the shipped OPEN turn verbatim — it is the one that
 * carries a plan, media, a live command and a running duration, and a second copy of it here would be
 * a second thing to keep true. */
export const LONG_TURNS: readonly Turn[] = [...SPEC.map(turnOf), SHOTS_TURN, OPEN_TURN]
