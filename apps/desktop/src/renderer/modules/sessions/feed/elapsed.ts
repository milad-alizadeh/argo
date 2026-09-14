// One elapsed-time formatter for every ticking Feed marker (Compaction, the Turn Marker): m:ss,
// floored, never negative even where a clock reads a hair behind its own start.
export function formatElapsed(elapsedMs: number): string {
  const elapsed = Math.max(0, elapsedMs)
  const minutes = Math.floor(elapsed / 60_000)
  const seconds = Math.floor((elapsed % 60_000) / 1_000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
