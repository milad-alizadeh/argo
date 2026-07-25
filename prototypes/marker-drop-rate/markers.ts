/**
 * The instrument IS the guard (#199 §2, #203).
 *
 * #199 makes the check tractable by constraining the *generator*, not by smartening the
 * checker: the reshaper must carry protected markers through as those exact words, so a
 * dumb token-presence test is exact and false-positive-free. This module is that test —
 * and, run over a corpus, the measuring instrument for #203.
 */

export type MarkerClass = "negation" | "restrictor" | "conditionality" | "hedging";

/**
 * #199 §1's four classes, deliberately WIDE. #203 prunes on the data, so a token that
 * turns out never to be dropped is a finding, not a bug — do not trim this by taste.
 */
export const LEXICON: Record<MarkerClass, readonly string[]> = {
  negation: [
    "not",
    "no",
    "never",
    "none",
    "without",
    "nor",
    "cannot",
    "neither",
    "nothing",
  ],
  restrictor: ["only", "just", "except", "all", "some", "every", "any", "solely"],
  conditionality: ["if", "unless", "until", "provided", "once", "whenever", "assuming"],
  hedging: [
    "might",
    "may",
    "probably",
    "seems",
    "likely",
    "could",
    "appears",
    "possibly",
    "perhaps",
    "unclear",
  ],
} as const;

const CLASS_OF = new Map<string, MarkerClass>(
  (Object.entries(LEXICON) as [MarkerClass, readonly string[]][]).flatMap(([cls, words]) =>
    words.map((w) => [w, cls] as [string, MarkerClass]),
  ),
);

/**
 * The closed substitution table (#199 §2). An equivalence is allowed IFF it is in here —
 * never because the reshaper judged it redundant.
 *
 * Seeded minimal ON PURPOSE. #203's job is to find which carries genuinely need an entry,
 * so every near-miss is logged as `untabled` rather than silently forgiven; the report
 * turns those into proposed rows. Growing this by imagination defeats the measurement.
 */
export const SUBSTITUTIONS: Record<string, readonly string[]> = {
  not: ["n't", "cannot", "can't", "won't", "doesn't", "didn't", "isn't", "wasn't", "aren't"],
  cannot: ["can't", "not able", "unable"],
  none: ["no"],
  might: ["may"],
  may: ["might"],
} as const;

/** Words that look like markers but are not, in the sense #199 protects. */
const HOMOGRAPH_STOPLIST = new Set([
  "just", // "just now" / "just released" — temporal, not restrictive
]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^a-z']+/)
    .filter(Boolean);

export type ExpectedMarker = {
  readonly token: string;
  readonly cls: MarkerClass;
  /** How many times it occurs in the faithful core — a second `not` can be load-bearing too. */
  readonly count: number;
};

/**
 * Extract the protected markers a reshaping MUST carry.
 *
 * Scope is #192's always-faithful column (#199 §3), so this is called on the corpus entry's
 * annotated `faithfulCore`, never on the whole source chunk — running it over the full chunk
 * would drag every `if` out of pullable reasoning into the lead, which #199 explicitly rejects.
 */
export function extractExpected(faithfulCore: string): ExpectedMarker[] {
  const counts = new Map<string, number>();
  for (const tok of tokenize(faithfulCore)) {
    const bare = tok.replace(/^'+|'+$/g, "");
    if (!CLASS_OF.has(bare) || HOMOGRAPH_STOPLIST.has(bare)) continue;
    counts.set(bare, (counts.get(bare) ?? 0) + 1);
  }
  return [...counts].map(([token, count]) => ({
    token,
    cls: CLASS_OF.get(token)!,
    count,
  }));
}

export type MarkerVerdict = "exact" | "substituted" | "missing";

export type MarkerResult = {
  readonly token: string;
  readonly cls: MarkerClass;
  readonly expected: number;
  readonly found: number;
  readonly verdict: MarkerVerdict;
  /** Set when missing but a plausible-but-untabled equivalent is present in the output. */
  readonly untabledCandidate?: string;
};

/**
 * Morphological forms that MEAN the marker survived but are not in the closed table.
 * Not used to pass the check — #199 rejects a tolerant checker. Used only to label a
 * miss as `untabled` so #203 can report which table rows are actually earned.
 */
const UNTABLED_HINTS: Record<string, readonly RegExp[]> = {
  not: [/\b\w+n't\b/, /\bun[a-z]{3,}\b/, /\bnon-?[a-z]{3,}\b/, /\b\w+less\b/, /\bfail(?:s|ed)? to\b/, /\bskipp?(?:ed|s)\b/, /\bwithout\b/],
  only: [/\balone\b/, /\bsolely\b/, /\bmerely\b/, /\bnothing but\b/, /\brestricted to\b/, /\blimited to\b/],
  unless: [/\bexcept (?:if|when)\b/, /\bother than (?:if|when)\b/],
  until: [/\bbefore\b/, /\bup to\b/],
  if: [/\bwhen\b/, /\bin case\b/, /\bshould\b/, /\bassuming\b/, /\bdepend(?:s|ing) on\b/],
  might: [/\bpossib(?:le|ly)\b/, /\bperhaps\b/, /\bnot certain\b/, /\bmaybe\b/],
  probably: [/\blikely\b/, /\bin all likelihood\b/],
  seems: [/\bappears?\b/, /\blooks like\b/],
  likely: [/\bprobabl[ey]\b/, /\bexpected to\b/],
  never: [/\bat no point\b/, /\bnot once\b/],
};

export function checkLine(expected: readonly ExpectedMarker[], spoken: string): MarkerResult[] {
  const tokens = tokenize(spoken);
  const lower = spoken.toLowerCase();
  const tally = new Map<string, number>();
  for (const tok of tokens) tally.set(tok, (tally.get(tok) ?? 0) + 1);

  return expected.map((exp) => {
    const exactHits = tally.get(exp.token) ?? 0;
    if (exactHits >= exp.count) {
      return { ...exp, expected: exp.count, found: exactHits, verdict: "exact" as const };
    }

    const subs = SUBSTITUTIONS[exp.token] ?? [];
    const subHits = subs.reduce(
      (n, s) => n + (s.includes(" ") ? (lower.includes(s) ? 1 : 0) : (tally.get(s) ?? 0)),
      0,
    );
    if (exactHits + subHits >= exp.count) {
      return {
        ...exp,
        expected: exp.count,
        found: exactHits + subHits,
        verdict: "substituted" as const,
      };
    }

    const hint = (UNTABLED_HINTS[exp.token] ?? []).find((re) => re.test(lower));
    return {
      ...exp,
      expected: exp.count,
      found: exactHits + subHits,
      verdict: "missing" as const,
      ...(hint ? { untabledCandidate: lower.match(hint)?.[0] } : {}),
    };
  });
}

/** #199 §4: the violating line is never spoken. This is the gate that decides that. */
export const isViolation = (results: readonly MarkerResult[]): boolean =>
  results.some((r) => r.verdict === "missing");

/** The retry prompt names the violated markers explicitly (#199 §4). */
export const namedRetryNote = (results: readonly MarkerResult[]): string => {
  const dropped = results.filter((r) => r.verdict === "missing").map((r) => `"${r.token}"`);
  return `Your previous line dropped ${dropped.join(", ")}. Carry ${
    dropped.length === 1 ? "that exact word" : "those exact words"
  } through into the spoken line. Say it again.`;
};

/**
 * #199 §4's terminal fallback: model-free, extractive. Reads the source's own faithful
 * core aloud, uncapped. Clunky-but-honest beats a second pass through the failure mode
 * being caught.
 */
export const extractiveFallback = (faithfulCore: string): string => faithfulCore.trim();
