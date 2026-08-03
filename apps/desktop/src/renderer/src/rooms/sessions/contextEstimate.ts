import { addUsage, isSteerable, rootAgent, type SessionView, type Usage } from '@shared'

// The context ring's estimate. Either half missing means no arc and `unknown`, never a default:
// the window is Argo-owned knowledge and the tokens are the transcript's (`cockpit-spec.md` §4.2).

// Every window Argo knows, keyed by the model-id prefix a transcript reports verbatim. An id no
// entry matches yields no percentage at all: guessing a window would turn the ring into a
// fabricated measurement. `[1m]` is the long-context variant marker, which multiplies the window
// rather than naming a different model.
const CONTEXT_WINDOWS: readonly [prefix: string, tokens: number][] = [
  ['claude-opus-4', 200_000],
  ['claude-opus-5', 200_000],
  ['claude-sonnet-4', 200_000],
  ['claude-sonnet-5', 200_000],
  ['claude-haiku-4', 200_000],
  ['gpt-5', 400_000],
]

const LONG_CONTEXT_MARKER = '[1m]'
const LONG_CONTEXT_TOKENS = 1_000_000

export function contextWindow(model: string | null): number | null {
  if (model === null) return null
  const match = CONTEXT_WINDOWS.find(([prefix]) => model.startsWith(prefix))
  if (!match) return null
  return model.includes(LONG_CONTEXT_MARKER) ? LONG_CONTEXT_TOKENS : match[1]
}

// Context in use is the newest turn's input side — the prompt plus everything the cache replayed
// into it — which is what the model actually re-reads each turn. Output tokens leave the window,
// so they are deliberately absent from the sum.
function contextTokens(usage: Usage): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
}

function newestUsage(session: SessionView): Usage | null {
  const root = rootAgent(session.agents)
  if (root === null) return null
  return root.turns.map((turn) => turn.usage).findLast((usage) => usage !== null) ?? null
}

/**
 * The ring's arc as a percentage, or `null` when either half of the estimate is missing.
 *
 * External sessions floor at `null` by posture rather than by data: Argo did not run them, so it
 * claims nothing about their context even where a transcript happens to carry usage.
 */
export function contextPercent(session: SessionView): number | null {
  if (!isSteerable(session.posture)) return null
  const window = contextWindow(session.model)
  const usage = newestUsage(session)
  if (window === null || usage === null) return null
  return (contextTokens(usage) / window) * 100
}

/** The Session's whole observed token spend — the roll-up `CONTEXT.md` puts on the Session. */
export function sessionUsage(session: SessionView): Usage | null {
  const observed = session.agents
    .flatMap((agent) => agent.turns)
    .map((turn) => turn.usage)
    .filter((usage) => usage !== null)
  return observed.length === 0 ? null : observed.reduce(addUsage)
}
