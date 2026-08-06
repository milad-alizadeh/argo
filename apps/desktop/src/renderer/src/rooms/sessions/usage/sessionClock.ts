import { format, formatDistanceStrict, type Locale } from 'date-fns'

// The three clock readings the interior draws, in one place so nothing downstream divides by a
// millisecond count or picks its own thresholds (`dependencies.md` — date/time is a solved problem).
// Every one of them returns `null` rather than a placeholder where the record carries no time: an
// unobservable moment renders as nothing at all, never as `0m` or `--:--`.

/**
 * How long ago something happened — `4 minutes`, `2 hours`, `3 days` — or `null` where the age
 * cannot be established: no timestamp observed, no wall clock injected, or a timestamp in the future
 * (a clock that disagrees with the record is not an age, and a negative one would be fabricated).
 *
 * Strict rather than `formatDistance`, which softens everything to "about 2 hours".
 */
export function relativeAge(atMs: number | null, nowMs: number | null): string | null {
  if (atMs === null || nowMs === null || atMs > nowMs) return null
  return formatDistanceStrict(atMs, nowMs)
}

/** The unit words a DURATION wears in a dense row, keyed by date-fns' own distance tokens.
 *
 * A locale rather than a regex over the output: date-fns is built to be told how to say a distance,
 * and post-processing `2 minutes` into `2min` with string replacement means re-deriving the plural
 * rules and the token set that library already owns (`dependencies.md` — date/time is solved).
 *
 * `min` and not `m`, because `m` is minutes to a clock and months to a formatter, and a subagent
 * row is exactly where that ambiguity would land. `formatDistanceStrict` only ever emits the `x…`
 * tokens, so those are all that need an entry. */
const COMPACT_UNITS: Readonly<Record<string, string>> = {
  xSeconds: 's',
  xMinutes: 'min',
  xHours: 'h',
  xDays: 'd',
  xWeeks: 'w',
  xMonths: 'mo',
  xYears: 'y',
}

/** A date-fns locale that says a distance in as few characters as it can. Only `formatDistance` is
 * supplied because that is the only member `formatDistanceStrict` reads. */
const COMPACT: Pick<Locale, 'formatDistance'> = {
  formatDistance: (token, count) => `${count}${COMPACT_UNITS[token] ?? ''}`,
}

/**
 * How long something took, running or finished — `2min`, `3h`, `4d`. An agent still working is
 * measured against the wall clock, which is why this takes `nowMs` and not just the two ends: a span
 * with no end yet is a real duration, not a missing one.
 *
 * COMPACT, because a duration only ever appears in a dense row (a subagent beside its name and its
 * spend, a tool call beside its time) where `2 minutes` costs three times the width of the fact and
 * pushes the name it sits next to into an ellipsis.
 *
 * `null` where there is no start to measure from, or where the span is still open and no wall clock
 * was injected.
 */
export function duration(
  startedAtMs: number | null,
  endedAtMs: number | null,
  nowMs: number | null,
): string | null {
  if (startedAtMs === null) return null
  const end = endedAtMs ?? nowMs
  if (end === null || end < startedAtMs) return null
  return formatDistanceStrict(startedAtMs, end, { locale: COMPACT })
}

/**
 * The wall-clock time a moment happened, `14:03`. What a tool call wants where an age does not
 * serve: a turn's calls land seconds apart, so every one of them would read the same distance back
 * and say nothing about when it happened.
 */
export function clockTime(atMs: number | null): string | null {
  return atMs === null ? null : format(atMs, 'HH:mm')
}
