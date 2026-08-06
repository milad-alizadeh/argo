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

// Context in use is the newest turn's own reading of the window — the prompt plus everything the
// cache replayed into it. Read off `contextTokens` rather than off `usage`, because `usage` is the
// turn's whole SPEND: a turn that made ten requests summed ten window-reads into it, and dividing
// that by one window is what put a fresh session at `~100%`.
function newestContext(session: SessionView): number | null {
  const root = rootAgent(session.agents)
  if (root === null) return null
  return root.turns.map((turn) => turn.contextTokens).findLast((tokens) => tokens !== null) ?? null
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
  const tokens = newestContext(session)
  if (window === null || tokens === null) return null
  return (tokens / window) * 100
}

/**
 * The Session's whole observed token spend — the roll-up `CONTEXT.md` puts on the Session.
 *
 * Two sources, because the tree reports spend at two grains: per Turn for an agent whose turns are
 * in this transcript, and whole-agent for a Subagent, whose own turns are not. Summing both is what
 * makes the header's figure the session's real cost rather than only the part it spent itself.
 */
export function sessionUsage(session: SessionView): Usage | null {
  const observed = [
    ...session.agents.flatMap((agent) => agent.turns).map((turn) => turn.usage),
    ...session.agents.map((agent) => agent.usage),
  ].filter((usage) => usage !== null)
  return observed.length === 0 ? null : observed.reduce(addUsage)
}

/** A token count as the surfaces spell it — `86k`, `Intl`-compacted rather than divided by a
 * thousand. The whole spend: both input sides and both cache lines, since the question is what it
 * COST — the ring's separate question drops output, because output leaves the window.
 *
 * Bare, with no unit word: the header has room to say `tokens` and a dense subagent row does not, so
 * the noun is the caller's to add. */
const COMPACT = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function tokenSpend(usage: Usage | null): string | null {
  if (usage === null) return null
  const total =
    usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
  return total === 0 ? null : COMPACT.format(total)
}
