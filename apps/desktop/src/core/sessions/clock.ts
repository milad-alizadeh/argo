// The two clocks a Roster row draws (`cockpit-roster-row.html` · the clock): how long the open
// Turn has run, to the second, and how long ago a settled Session last wrote, to its largest unit.
// A duration a reader watches tick needs its seconds; an age a reader glances at does not.

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function two(value: number): string {
  return String(value).padStart(2, '0')
}

// `40s`, `4m 12s`, `1h 03m`, `51d 03h`. A Turn left open for days, which a Session that asks and
// is never answered does, reads in days rather than as a four-digit hour count. A clock read
// before its own start, which a skewed record can cause, reads zero rather than a negative time.
export function turnDuration(elapsed: number): string {
  const seconds = Math.floor(Math.max(0, elapsed) / SECOND)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${two(seconds % 60)}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${two(minutes % 60)}m`
  return `${Math.floor(hours / 24)}d ${two(hours % 24)}h`
}

// `40s`, `18m`, `1h`, `3d`.
export function compactAge(elapsed: number): string {
  const since = Math.max(0, elapsed)
  if (since < MINUTE) return `${Math.floor(since / SECOND)}s`
  if (since < HOUR) return `${Math.floor(since / MINUTE)}m`
  if (since < DAY) return `${Math.floor(since / HOUR)}h`
  return `${Math.floor(since / DAY)}d`
}
