export function elapsedMilliseconds(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): number | null {
  if (startedAt === null || startedAt === undefined) return null
  if (endedAt === null || endedAt === undefined) return null
  const started = Date.parse(startedAt)
  const ended = Date.parse(endedAt)
  if (Number.isNaN(started) || Number.isNaN(ended)) return null
  return Math.max(0, ended - started)
}
