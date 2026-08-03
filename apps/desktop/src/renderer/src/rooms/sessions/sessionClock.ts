import { format, formatDistanceStrict } from 'date-fns'

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

/**
 * How long something took, running or finished. An agent still working is measured against the wall
 * clock, which is why this takes `nowMs` and not just the two ends — a span with no end yet is a
 * real duration, not a missing one.
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
  return formatDistanceStrict(startedAtMs, end)
}

/**
 * The wall-clock time a moment happened, `14:03`. What a tool call wants where an age does not
 * serve: a turn's calls land seconds apart, so every one of them would read the same distance back
 * and say nothing about when it happened.
 */
export function clockTime(atMs: number | null): string | null {
  return atMs === null ? null : format(atMs, 'HH:mm')
}
