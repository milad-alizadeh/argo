// One elapsed-time formatter for every ticking Feed marker (Compaction, the Turn Marker): m:ss,
// floored, never negative even where a clock reads a hair behind its own start.
export function formatElapsed(elapsedMs: number): string {
  const elapsed = Math.max(0, elapsedMs)
  const minutes = Math.floor(elapsed / 60_000)
  const seconds = Math.floor((elapsed % 60_000) / 1_000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// A Turn's running time: tenths of a second for its first minute, then minutes and seconds.
export function formatTurnElapsed(elapsedMs: number): string {
  const elapsed = Math.max(0, elapsedMs)
  if (elapsed < 60_000) return `${(Math.floor(elapsed / 100) / 10).toFixed(1)}s`
  const minutes = Math.floor(elapsed / 60_000)
  const seconds = Math.floor((elapsed % 60_000) / 1_000)
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}
