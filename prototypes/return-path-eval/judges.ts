/**
 * The council — five axes, one specialist judge each, blinded.
 *
 * Binary verdict plus a MANDATORY evidence quote, not a 1-5 score. Two reasons. #203's
 * precedent is rates, which are comparable across arms and across models in a way a 3.4-vs-3.7
 * is not — and "reversible with evidence" (#222 §5) requires a comparison, so an uncalibrated
 * score would not be evidence at all. And a binary claim backed by a quote is auditable: a
 * judge asserting "contradicted" has to point at the words, so a wrong judge is visibly wrong
 * rather than merely a number you distrust.
 *
 * Every axis is phrased as a VIOLATION question, so `yes` always means "bad" — for the judge,
 * for the aggregation, and for anyone reading a row. Mixed polarity across axes is how a
 * rubric quietly inverts one of its own scores.
 *
 * BLINDING is structural, not a promise: `judgePrompt` takes the source and the spoken line
 * and has no parameter through which the arm, model or config could reach it.
 */

export type AxisId =
  | 'believed-false'
  | 'contradicted'
  | 'marker-dropped'
  | 'depth-dropped-uncued'
  | 'under-condensed'

export type Axis = {
  readonly id: AxisId
  /** #222 §5: "a council of LLM judges ... with #192 and #199 as the rubric." */
  readonly rubric: string
  /** Adversarial redundancy. Only the hard invariant earns more than one judge. */
  readonly voters: number
}

export const AXES: readonly Axis[] = [
  {
    id: 'contradicted',
    // #192's hard invariant, and the only axis where a false negative is the failure the whole
    // design fears — #199's unrecoverable-by-noticing argument, recorded unanswered by #222 §4.
    // Three voters, majority. Every other axis is recoverable by looking at the screen.
    voters: 3,
    rubric: `Does the spoken line assert anything the source CONTRADICTS?

This is the hard invariant: voice is allowed to be lossy, never misleading. A contradiction is
any place a listener who heard only the spoken line would believe something the source says is
false. Flipped polarity, a hedge stated as certainty, a condition dropped so an "if X then Y"
becomes a bare "Y", a scope widened from "only the parser" to "the whole module", a
recommendation attributed to the wrong option.

WHO DID WHAT is part of this. If the source says the agent did something ("I did not touch the
STT adapter") and the spoken line attributes it to the listener ("You did not touch the STT
adapter"), or the reverse, that is a contradiction — the listener now believes they performed
an action they did not, which is exactly the kind of error they cannot catch by ear. Judge
person and agency as strictly as you judge polarity. (Added because a real run produced this
flip and three judges scored it clean.)

Omission alone is NOT a contradiction — that is other axes. Judge only whether the spoken line
makes a claim the source refutes.`,
  },
  {
    id: 'believed-false',
    voters: 1,
    rubric: `Would a listener who heard ONLY the spoken line end up with a materially false
picture of what happened?

This is broader than a sentence-level contradiction: judge the impression, not the wording. A
line where every clause is individually defensible but the overall takeaway is wrong — "tests
pass" when 3 of 415 fail, "it's done" when it is blocked on you — is a violation here even if
no single statement is refuted.`,
  },
  {
    id: 'marker-dropped',
    voters: 1,
    rubric: `Did any PROTECTED MARKER present in the source's load-bearing content fail to
survive into the spoken line, changing what the listener believes is true?

The four classes (#199): negation and polarity (not, no, never, none, without, cannot); scope
restrictors (only, just, except, all, some, every); conditionality (if, unless, until,
provided, once); hedging (might, may, probably, seems, likely, could).

The test is the one that defined the class: does removing it change what the listener believes
is true? A marker in content the line legitimately dropped entirely is NOT a violation — this
axis is about markers inside what was kept. A synonym that preserves the marker's force is
fine; "X untouched" for "did not touch X" is not, because it flattens the polarity.`,
  },
  {
    id: 'depth-dropped-uncued',
    voters: 1,
    rubric: `Did the spoken line drop MATERIAL DEPTH without any cue that more exists?

#192: content is pullable, but the cue fires when material depth was dropped. Material means
the listener would plausibly want it and cannot know to ask for it. A dropped list of three
option bodies is material; a dropped restatement is not.

A cue is any signal that there is more — "there's more", "want the details", naming that a
list exists. Violation = material depth dropped AND no cue.`,
  },
  {
    id: 'under-condensed',
    voters: 1,
    // The direction #199's guard was structurally blind to (the map's own coverage-gap entry:
    // "a line that keeps every marker by refusing to condense scores clean and still fails
    // #192"). #222 dissolved that gap by moving scoring offline, where a proxy is unnecessary.
    rubric: `Is the spoken line UNLISTENABLE — faithful, but too long or too dense to take in
by ear?

This is the opposite failure from every axis above, and the one a marker-counter cannot see. A
line that quotes most of the source scores perfectly on fidelity and still fails the user, who
is doing something else and cannot re-read it.

Violation if: it would take much more than a breath or two to say; it recites a table, a file
list, or a sequence of numbers; it keeps scaffolding ("Let me explain", "First... Second...")
that carries no information by ear; or a listener would have lost the thread before the end.`,
  },
]

export const JUDGE_SYSTEM_PROMPT = `You are one axis of a review council scoring a voice
assistant's spoken output against the original text it was derived from.

The assistant's user has the original on screen. Voice is the eyes-free channel over it, so it
is ALLOWED to be lossy. It is NEVER allowed to be misleading. You judge exactly one axis; other
judges cover the others, so do not compensate for them.

Answer only the question you are given. Be decisive: if the answer is genuinely borderline,
answer no. A false alarm costs more than a miss here, because every yes is read as a defect.

REPLY FORMAT — these two lines exactly, nothing before or after:
VERDICT: yes | no
EVIDENCE: <a short quote from the spoken line, or from the source, showing why. If your verdict
is no, quote the part that made you confident.>`

export const judgePrompt = (axis: Axis, source: string, spoken: string): string =>
  `QUESTION FOR YOUR AXIS:
${axis.rubric}

--- SOURCE (what the agent actually wrote) ---
${source}

--- SPOKEN LINE (what the listener heard) ---
${spoken}

Answer for your axis only, in the required two-line format.`

export type Verdict = {
  readonly violation: boolean
  readonly evidence: string
  /** True when the reply did not parse. Counted separately — never silently scored as clean. */
  readonly unparsable: boolean
}

export const parseVerdict = (reply: string): Verdict => {
  const line = (name: string): string =>
    reply
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toUpperCase().startsWith(`${name}:`))
      ?.slice(name.length + 1)
      .trim() ?? ''
  const v = line('VERDICT').toLowerCase()
  const yes = v.startsWith('y')
  const no = v.startsWith('n')
  return { violation: yes, evidence: line('EVIDENCE'), unparsable: !yes && !no }
}
