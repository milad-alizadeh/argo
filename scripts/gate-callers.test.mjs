#!/usr/bin/env node
// The two tables `bun run gate:report` gained, run via `bun run test:hooks` (#1711).
//
// What each case proves is that the report can still say which STEP paid. The columns those
// tables read are `gate-columns.test.mjs`'s question; both share one row builder, because that
// builder is the column contract.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { gatesFrom, now, ROOT, row, rowsFrom, scratch } from './gate-callers.harness.mjs'
import { byCallerAndPhase, renderCallerPhases, renderRepeatedFullGates } from './gate-callers.mjs'

check('full runs and cache hits are counted per caller and phase', () => {
  const tally = byCallerAndPhase(
    gatesFrom([
      row({ caller: 'implement', outcome: 'run', seconds: 200 }),
      row({ caller: 'implement', outcome: 'run', seconds: 100 }),
      row({ caller: 'ship', outcome: 'hit', seconds: 0 }),
      row({ caller: 'ship', outcome: 'hit', seconds: 0 }),
      row({ caller: 'push', outcome: 'skip', seconds: 2 }),
    ]),
  )

  assert.deepEqual(
    tally.map((t) => [t.caller, t.full, t.hits, t.skips]),
    [
      ['implement', 2, 0, 0],
      ['push', 0, 0, 1],
      ['ship', 0, 2, 0],
    ],
  )
  assert.equal(tally[0].median, 200, 'the median prices a full run of that pair only')
})

// The table has to read STEP rows, not gate rows alone. `swift-gate.sh` is the only writer of
// an `event=gate` row and it stamps every one `gate`, so a table of those has one phase in it
// and the split the ticket asks for says nothing. `correctness` and `cost` are step rows.
check("a step's phase is counted apart from the gate's", () => {
  const tally = byCallerAndPhase(
    rowsFrom([
      row({ caller: 'implement', event: 'gate', phase: 'gate', outcome: 'run' }),
      row({ caller: 'implement', event: 'step', phase: 'correctness', outcome: 'run' }),
      row({ caller: 'implement', event: 'step', phase: 'cost', outcome: 'hit' }),
    ]),
  )

  assert.deepEqual(
    tally.map((t) => [t.phase, t.full, t.hits]),
    [
      ['correctness', 1, 0],
      ['cost', 0, 1],
      ['gate', 1, 0],
    ],
  )
})

// And nothing else: a `land` row is neither a gate nor a step, and counting it would put a
// number in this table that no phase of the gate paid.
check('a row that is neither a gate nor a step is not in the table', () => {
  assert.deepEqual(byCallerAndPhase(rowsFrom([row({ event: 'land', name: 'land:#1711' })])), [])
})

check('the branch that paid three full gates is named, with the caller of each', () => {
  const lines = renderRepeatedFullGates(
    gatesFrom([
      row({ branch: 'argo/#1703-lane', caller: 'implement', when: '2026-09-08T01:00:00Z' }),
      row({ branch: 'argo/#1703-lane', caller: 'ship', when: '2026-09-08T02:00:00Z' }),
      row({ branch: 'argo/#1703-lane', caller: 'push', when: '2026-09-08T03:00:00Z' }),
      row({ branch: 'argo/#1700-quiet', caller: 'ship' }),
    ]),
  ).join('\n')

  assert.match(lines, /argo\/#1703-lane {2}3 full gates/)
  for (const caller of ['implement', 'ship', 'push']) {
    assert.match(lines, new RegExp(`${caller}/gate`), `${caller} is not named as a payer`)
  }
  assert.doesNotMatch(lines, /#1700-quiet/, 'a branch that paid once is not a repeat')
})

// A cache HIT is not a payment, so a branch that gated once and read the verdict back twice is
// not a branch that paid twice — which is the whole shape #1711 asks the report to show.
check('a branch that gated once and cached twice is not a repeat payer', () => {
  const lines = renderRepeatedFullGates(
    gatesFrom([
      row({ branch: 'argo/#1711-once', caller: 'implement', outcome: 'run' }),
      row({ branch: 'argo/#1711-once', caller: 'ship', outcome: 'hit' }),
      row({ branch: 'argo/#1711-once', caller: 'push', outcome: 'hit' }),
    ]),
  ).join('\n')
  assert.doesNotMatch(lines, /#1711-once/)
})

check('a window where every branch gated once says so rather than printing nothing', () => {
  const lines = renderRepeatedFullGates(gatesFrom([row({ branch: 'argo/#1700-quiet' })]))
  assert.match(lines.join('\n'), /none — every branch in this window paid at most one/)
})

check('the report explains an unknown caller instead of leaving it bare', () => {
  const lines = renderCallerPhases(gatesFrom([row({ caller: 'unknown', phase: 'unknown' })]))
  assert.match(lines.join('\n'), /nothing set ARGO_GATE_CALLER/)
})

check('gate:report prints both tables over a real file', () => {
  const file = path.join(scratch, 'report.tsv')
  writeFileSync(
    file,
    `${[
      row({ caller: 'implement', when: now() }),
      row({ caller: 'ship', outcome: 'hit', when: now() }),
      row({ caller: 'implement', event: 'step', phase: 'cost', name: 'swift-test', when: now() }),
    ].join('\n')}\n`,
  )

  const out = execFileSync(process.execPath, ['scripts/gate-report.mjs', '--file', file], {
    cwd: ROOT,
    encoding: 'utf8',
  })

  assert.match(out, /By caller and phase/)
  assert.match(out, /implement\/gate/)
  assert.match(out, /implement\/cost/, 'a step phase must reach the table too')
  assert.match(out, /Branches that paid more than one full gate/)
})

report('gate callers')
