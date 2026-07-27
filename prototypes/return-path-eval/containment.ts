/**
 * The containment check — #222 §2's total, deterministic guarantee.
 *
 * "Is every emitted span a literal substring of the source?" is ground truth rather than a
 * proxy, which is why #222 dropped #199's four-class marker check in favour of it. That
 * property is only worth having if we do not quietly erode it, so this module draws one hard
 * line: **normalisation may destroy formatting, never meaning.**
 *
 * Normalisation is not optional. Measured on this machine: 129 real assistant turns of >=150
 * words, and **100% of them contain markdown** (`**`, backticks, bullets, headings, tables).
 * A router that quotes `**412 tests pass**` complete with asterisks has emitted something no
 * audio model can speak; one that strips them has broken a strict `includes`. Stripping the
 * asterisks somewhere else just moves the unchecked edit to a stage nobody is looking at.
 *
 * So the normaliser is a **closed** list of meaning-neutral transforms, and the report always
 * carries BOTH rates — strict-exact and normalised — so the leniency's cost is visible rather
 * than assumed (#203's precedent: log what the substitution table bought, never hide it).
 */

/** One meaning-neutral transform. Adding to this list is a decision, not a convenience. */
type Transform = {
  readonly name: string
  readonly apply: (s: string) => string
}

/**
 * Ordered, closed, and every entry is defensible as "formatting, not meaning".
 *
 * Deliberately ABSENT, and each absence is the point:
 * - case folding — `NOT` vs `not` is emphasis, but `IT` vs `it` can be an identifier
 * - punctuation stripping — a dropped `?` turns a question into a statement
 * - stopword or filler removal — that is paraphrase with extra steps
 * - stemming / lemmatisation — `failed` vs `fails` is a tense claim about the world
 */
const TRANSFORMS: readonly Transform[] = [
  { name: 'nfkc', apply: (s) => s.normalize('NFKC') },
  // Curly quotes and dashes are typography. The characters differ; the words do not.
  {
    name: 'typography',
    apply: (s) =>
      s
        .replace(/[‘’‛]/g, "'")
        .replace(/[“”‟]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/…/g, '...'),
  },
  // Markdown emphasis and code delimiters. The delimiters are display instructions; the text
  // between them is the content and survives untouched.
  {
    name: 'md-inline',
    apply: (s) => s.replace(/```+/g, '').replace(/[*_`~]/g, ''),
  },
  // Line-leading structure: headings, bullets, numbered items, blockquotes, table pipes.
  {
    name: 'md-block',
    apply: (s) =>
      s
        .split('\n')
        .map((l) => l.replace(/^\s*(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/, '').replace(/\|/g, ' '))
        .join('\n'),
  },
  // Markdown links: keep the label the listener would hear, drop the URL machinery.
  { name: 'md-link', apply: (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') },
  // Whitespace last, so every transform above can leave ragged gaps behind it.
  { name: 'whitespace', apply: (s) => s.replace(/\s+/g, ' ').trim() },
]

export const normalise = (s: string): string =>
  TRANSFORMS.reduce((acc, t) => t.apply(acc), s)

export type SpanVerdict = {
  readonly span: string
  /** Literal `source.includes(span)`, no normalisation. The unsoftened number. */
  readonly exact: boolean
  /** The operative check: contained after meaning-neutral normalisation on both sides. */
  readonly contained: boolean
  /**
   * Contained only *because* of normalisation. Not a failure — the quantity that tells us how
   * much of the check's ground-truth property we traded away for markdown.
   */
  readonly normalisationRescued: boolean
  /**
   * For a non-contained span: the longest prefix of the span that IS present in the source,
   * as a word count. A high value means the model drifted mid-quote (the classic silent
   * paraphrase); a low one means it invented the span wholesale. Different defects.
   */
  readonly matchedPrefixWords: number
}

/**
 * How far into the span the quote held before it diverged.
 *
 * This is the diagnostic #222 §2 could not have: knowing THAT a model paraphrases is one
 * number, knowing that it copies eleven words then drifts is a different finding with a
 * different remedy.
 */
const matchedPrefixWords = (source: string, span: string): number => {
  const words = span.split(' ').filter(Boolean)
  let lo = 0
  let hi = words.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (source.includes(words.slice(0, mid).join(' '))) lo = mid
    else hi = mid - 1
  }
  return lo
}

export const checkSpan = (rawSource: string, rawSpan: string): SpanVerdict => {
  const source = normalise(rawSource)
  const span = normalise(rawSpan)
  const exact = rawSource.includes(rawSpan)
  const contained = span.length > 0 && source.includes(span)
  return {
    span: rawSpan,
    exact,
    contained,
    normalisationRescued: contained && !exact,
    matchedPrefixWords: contained ? span.split(' ').filter(Boolean).length : matchedPrefixWords(source, span),
  }
}

export const checkAll = (source: string, spans: readonly string[]): readonly SpanVerdict[] =>
  spans.map((s) => checkSpan(source, s))
