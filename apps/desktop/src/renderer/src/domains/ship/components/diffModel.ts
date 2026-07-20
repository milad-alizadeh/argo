import type { FindingSeverity, FindingState } from '@/shared/components/ui'

/** M(odified) / A(dded) / D(eleted) / R(enamed) — a file's status in the diff. */
export type FileChangeKind = 'M' | 'A' | 'D' | 'R'

/** One printed line of a hunk: which side it's on, and its text (already prefixed). */
export type DiffHunkLine = { side: 'add' | 'del' | 'context'; text: string }

/** A review finding as FileDiff and FindingCard need it — a line-anchored fact about one
 * file, keyed to the same `id` the Review tab's FindingRow reports (R14: two homes, one
 * finding). */
export interface DiffFinding {
  id: string
  severity: FindingSeverity
  state: FindingState
  line: number
  body: string
  by: string
}

const FINDING_BODY_STUB_LENGTH = 46

/** The one-line preview a resolved finding collapses to — `fixed · {body}…`, per the study's
 * `.fstub`. Always ellipsised, even when `body` is short: the stub reads as a pointer back to
 * the full text above it, not as the whole sentence. */
export function findingBodyStub(body: string): string {
  return `${body.slice(0, FINDING_BODY_STUB_LENGTH)}…`
}
