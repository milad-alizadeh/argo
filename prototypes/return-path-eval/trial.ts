/**
 * The trial record and the one rule for collapsing duplicates.
 *
 * Duplicates arise two ways and they want OPPOSITE tie-breaks, which is why this is a named
 * rule rather than an inline `new Map(...)`:
 *
 *   retry      `sweep.ts --retry-errors` appends a fresh attempt after a failure — later is
 *              better.
 *   collision  two sweeps writing the same file (a real incident: an orphaned background run
 *              overlapped a relaunch) can append a failure AFTER a success for the same key —
 *              later is worse.
 *
 * Last-wins serves the first and silently corrupts the second, and it did: seven trials with a
 * perfectly good result on disk were reported as timeouts because a duplicate failure landed
 * after them. So the rule is **prefer a success; among equals, last wins.** Status first,
 * recency second.
 */

import type { ArmId } from './arms'
import type { SpanVerdict } from './containment'
import type { Arm } from './corpus'
import type { CouncilResult } from './council'

export type Trial = {
  readonly key: string
  readonly chunkId: string
  readonly corpusArm: Arm
  readonly arm: ArmId
  readonly sourceWords: number
  readonly routerMs: number
  readonly routerProblems: readonly string[]
  /** Span arms only. */
  readonly spans?: readonly SpanVerdict[]
  /** Absent on redacted arm-B rows — see `redact.ts`. */
  readonly payload?: string
  readonly payloadWords: number
  readonly spokenMs?: number
  readonly spoken?: string
  readonly spokenWords?: number
  readonly council?: CouncilResult
  /** Precomputed by `redact.ts` so a text-free row still answers the verbatim question. */
  readonly verbatim?: boolean
  readonly error?: string
}

export const dedupe = (rows: readonly Trial[]): Trial[] => {
  const best = new Map<string, Trial>()
  for (const row of rows) {
    const held = best.get(row.key)
    // Keep the incumbent only when it succeeded and the challenger did not.
    if (held && !held.error && row.error) continue
    best.set(row.key, row)
  }
  return [...best.values()]
}

export const readTrials = async (path: string): Promise<Trial[]> =>
  dedupe(
    (await Bun.file(path).text())
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Trial),
  )
