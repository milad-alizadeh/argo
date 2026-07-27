/**
 * The router's span-emission contract — the artifact #222 decided on and nobody had written.
 *
 * #222 §2 says the router "emits verbatim spans of the worker's own text, selected but never
 * rewritten". Grilled against a worked example that turned out to be decisive: **zero of the
 * 42 hand-authored `faithfulCore`s in `../marker-drop-rate/corpus.ts` are a literal substring
 * of their source.** Human ground truth for "what must survive" is never pure quotation. Three
 * forces break it, and the contract below is shaped around each:
 *
 *   deixis         `so those failures predate it` -> the antecedent is outside the span
 *                  => a span must be WHOLE SENTENCES, so the antecedent rides along.
 *   derived facts  #192 rule 3's option count is computed, not stated ("Three ways to fix
 *                  this" -> "three options existed" appears nowhere)
 *                  => a typed scaffold carries what cannot be quoted.
 *   stitching      discontiguous fragments joined naively are ungrammatical
 *                  => spans are an ordered list, and joining is the audio model's problem,
 *                     which is fine because phrasing is its job (#221, #222 §1).
 *
 * The budget is RELEVANCE, never length. #203 measured a word cap as the direct cause of
 * marker loss (15.7% uncapped -> 43.8% at 15 words), so the router gets no cap at all — but
 * "no cap" is not "no criterion". The criterion is #192 rule 2's type table, already decided,
 * so this file writes no new rule. Router reduces by relevance; the audio model compresses not
 * at all. Each stage gets the one job it can do without lying.
 */

export type ChunkType = 'prompt-for-user' | 'recommendation' | 'result'

export type ReducedPayload = {
  readonly type: ChunkType
  /** #192 rule 3. `null` when no choice was offered — distinct from 0, which never occurs. */
  readonly optionCount: number | null
  /** #192 rule 2's prompt-for-user row: "plus any destructive or irreversible flag". */
  readonly destructive: boolean
  /** Ordered, kernel first. Every element must be verbatim; `containment.ts` decides. */
  readonly spans: readonly string[]
}

/**
 * The type table, quoted from `../marker-drop-rate/contract.ts` rule 2 rather than reworded.
 * If #192 changes, this string is the single place that follows it.
 */
const TYPE_TABLE = `  prompt-for-user: the ask, plus any destructive or irreversible flag.
  recommendation:  the headline pick, and that a choice existed.
  result:          the outcome, plus any value the user would act on.`

/**
 * A line-oriented reply format, NOT JSON — and that is a fidelity decision, not a style one.
 * JSON would force the model to escape quotes, newlines and backslashes inside the span text,
 * which is itself an edit to the bytes we are about to check for literal containment. A line
 * format lets the span through unmodified.
 */
export const ROUTER_SYSTEM_PROMPT = `You reduce one chunk of a coding agent's transcript for a voice concierge.

You are NOT writing a spoken line. A separate model does the speaking. Your only job is to
SELECT which of the source's own sentences it should speak, and hand them over unchanged.

SELECT by relevance, using this table for the chunk's type:
${TYPE_TABLE}

Quote the sentences that carry those things. Quote no others.

RULES
1. Every SPAN must be one or more COMPLETE sentences, copied CHARACTER FOR CHARACTER from the
   source. Do not fix grammar, expand contractions, resolve pronouns, change tense, drop a
   parenthetical, or tidy punctuation. If a sentence needs its neighbour to make sense, take
   both — taking more is always allowed and always correct.
2. There is NO length limit and NO word target. Do not compress, do not trim, do not pick the
   shortest option. Taking a whole long sentence beats taking an accurate short fragment.
3. Order SPANs so the KERNEL comes first — the single thing the listener most needs — even
   when the source puts it last.
4. Facts you cannot quote go in the header, never in a SPAN. If the source offers choices,
   count them and put the number in OPTIONS even when the source never states a count.
5. Never write a sentence of your own. Every SPAN line is copied text.

REPLY FORMAT — these lines exactly, nothing before or after, no markdown fence:
TYPE: prompt-for-user | recommendation | result
OPTIONS: <integer, or none>
DESTRUCTIVE: yes | no
SPAN: <one or more complete sentences, verbatim>
SPAN: <...repeat for each, kernel first>`

export const routerUserPrompt = (source: string): string =>
  `Reduce this transcript chunk:\n\n${source}`

const TYPES: readonly ChunkType[] = ['prompt-for-user', 'recommendation', 'result']

/**
 * Parse leniently and record what was wrong, rather than throwing.
 *
 * A router reply we cannot parse is a real result — it is the design failing — so it has to
 * reach the report as data. Throwing would drop the row and silently improve every rate.
 */
export const parseRouterReply = (
  reply: string,
): { payload: ReducedPayload; problems: readonly string[] } => {
  const problems: string[] = []
  const lines = reply.split('\n').map((l) => l.trim())
  const field = (name: string): string | undefined =>
    lines.find((l) => l.toUpperCase().startsWith(`${name}:`))?.slice(name.length + 1).trim()

  const rawType = field('TYPE')?.toLowerCase()
  const type = TYPES.find((t) => rawType?.includes(t)) ?? 'result'
  if (!TYPES.some((t) => rawType?.includes(t))) problems.push(`unparsable TYPE: ${rawType ?? '(absent)'}`)

  const rawOptions = field('OPTIONS')?.toLowerCase() ?? 'none'
  const optionsMatch = rawOptions.match(/\d+/)
  const optionCount = optionsMatch ? Number(optionsMatch[0]) : null
  if (!optionsMatch && !rawOptions.includes('none')) problems.push(`unparsable OPTIONS: ${rawOptions}`)

  const destructive = (field('DESTRUCTIVE') ?? 'no').toLowerCase().startsWith('y')

  const spans = lines
    .filter((l) => l.toUpperCase().startsWith('SPAN:'))
    .map((l) => l.slice('SPAN:'.length).trim())
    .filter(Boolean)
  if (spans.length === 0) problems.push('no SPAN lines')

  // Prose outside the format is the model narrating instead of complying — worth counting,
  // because #212's "unparsable output is spoken, never swallowed" rule depends on how often
  // this happens.
  const strayProse = lines.filter(
    (l) => l.length > 0 && !/^(TYPE|OPTIONS|DESTRUCTIVE|SPAN):/i.test(l),
  )
  if (strayProse.length > 0) problems.push(`${strayProse.length} stray line(s) outside the format`)

  return { payload: { type, optionCount, destructive, spans }, problems }
}

/**
 * What the audio model actually receives, as a user-role conversation item.
 *
 * Plain text, not JSON — a model whose entire job is to vocalise its context is the worst
 * possible audience for brace-and-quote syntax, and #221 established we cannot forbid it from
 * reading anything aloud, only ask. The `[REDUCED]` prefix follows the precedent #221 found in
 * the incumbent's own source, which injects backend text as a `[BACKEND] `-prefixed user-role
 * item rather than a structured field.
 */
export const renderForSpeaker = (p: ReducedPayload): string => {
  const header = [
    p.type,
    p.optionCount === null ? null : `${p.optionCount} options`,
    p.destructive ? 'DESTRUCTIVE' : null,
  ]
    .filter(Boolean)
    .join(' • ')
  return `[REDUCED] ${header}\n\n${p.spans.join('\n')}`
}
