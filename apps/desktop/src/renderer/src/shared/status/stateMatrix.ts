import type { SessionFactsInput } from '@shared'

// The S0–S11 delivery state matrix (docs/designs/cockpit-matrix.md), one row per case: the
// facts input that drives a Session through the lifecycle, with a stable id and a human label.
// The ONE home for these inputs — the derivation test replays them to prove the lifecycle,
// and the SessionScreen stories replay them to exercise the assembled screen — so the two can
// never fall out of step over what "S6" means.

export interface StateMatrixRow {
  id: string
  label: string
  input: SessionFactsInput
}

// Module-local fixtures for the rows below — not exported: nothing outside this file consumes
// them (stories/tests that need a sha or PR declare their own).
const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const

export const STATE_MATRIX_ROWS: readonly StateMatrixRow[] = [
  { id: 'S0', label: 'clean tree, no commits', input: {} },
  { id: 'S1', label: 'dirty 3 · agent working', input: { dirty: 3, agent: 'working' } },
  {
    id: 'S2',
    label: 'dirty 3 · agent idle',
    input: { dirty: 3, agent: 'idle', status: 'needs-input' },
  },
  {
    id: 'S3',
    label: 'commits ✓ · no PR',
    input: { headSha: HEAD, agent: 'idle', status: 'needs-input' },
  },
  {
    id: 'S3b',
    label: 'S3 · create_pr: auto',
    input: { headSha: HEAD, policy: { createPr: 'auto' } },
  },
  {
    id: 'S4',
    label: 'PR #42 · CI running',
    input: { headSha: HEAD, pr: PR, ci: { status: 'running', sha: HEAD } },
  },
  {
    id: 'S5',
    label: 'CI failed',
    input: { headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } },
  },
  {
    id: 'S6',
    label: 'CI ✓ · review running',
    input: {
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'running', sha: HEAD, findings: 0 }],
    },
  },
  {
    id: 'S7',
    label: 'changes requested · 2 open',
    input: {
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'changes', sha: HEAD, findings: 2 }],
    },
  },
  {
    id: 'S8',
    label: 'approved · all fresh',
    input: {
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
    },
  },
  {
    id: 'S8b',
    label: 'S8 · merge: auto',
    input: {
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
      policy: { merge: 'auto' },
    },
  },
  {
    id: 'S9',
    label: '+1 commit while PR open',
    input: {
      headSha: HEAD,
      unpushed: 1,
      pr: PR,
      ci: { status: 'passed', sha: OLD },
      review: [{ by: '@sam', verdict: 'approved', sha: OLD, findings: 0 }],
    },
  },
  {
    id: 'S10',
    label: 'merged',
    input: {
      headSha: HEAD,
      pr: { num: 38, state: 'merged', base: 'main' },
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
    },
  },
  {
    id: 'S11',
    label: 'closed w/o merge',
    input: {
      headSha: HEAD,
      pr: { num: 35, state: 'closed', base: 'main' },
      ci: { status: 'passed', sha: HEAD },
    },
  },
]

/** The facts input for a state-matrix row id, thrown on an unknown id so a mistyped `Sx` in a
 * story or a test fails loudly rather than silently rendering the clean-tree default. */
export function stateMatrixInput(id: string): SessionFactsInput {
  const row = STATE_MATRIX_ROWS.find((r) => r.id === id)
  if (!row) throw new Error(`unknown state-matrix row: ${id}`)
  return row.input
}
