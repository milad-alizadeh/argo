import { formatDistanceStrict } from 'date-fns'

/**
 * How long ago something happened — `4 minutes`, `2 hours`, `3 days` — or `null` where the age
 * cannot be established: no timestamp observed, no wall clock injected, or a timestamp in the future
 * (a clock that disagrees with the record is not an age, and a negative one would be fabricated).
 *
 * `formatDistanceStrict` picks the unit and does the calendar-correct differencing, so nothing here
 * chooses thresholds or divides by a fixed millisecond count (`dependencies.md` — date/time is a
 * solved problem). Strict rather than `formatDistance`, which softens everything to "about 2 hours".
 */
export function relativeAge(atMs: number | null, nowMs: number | null): string | null {
  if (atMs === null || nowMs === null || atMs > nowMs) return null
  return formatDistanceStrict(atMs, nowMs)
}
