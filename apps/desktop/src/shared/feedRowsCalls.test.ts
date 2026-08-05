import { describe, expect, it } from 'vitest'
import { aCall, anAgent, anEdit, anOutput, aTurn } from './__fixtures__/tree'
import { feedRows } from './feedRows'
import type { ToolCall } from './runtimeTree'

// The rows a single call gets: a command, which always shows the line it ran, and a failure of any
// kind, which shows what went wrong without a click.

const rowOf = (call: ToolCall) => feedRows(anAgent([aTurn({ id: 't1', toolCalls: [call] })]))[0]

const aCommand = (over: Partial<ToolCall> = {}): ToolCall =>
  aCall({ id: 'x', name: 'Bash', kind: 'execute', target: 'bun run test', ...over })

// A build log: long enough to be worth a click rather than the column it would cost.
const A_LOG = Array.from({ length: 40 }, (_, line) => `[${line}] compiled module`).join('\n')

// No row carries an `open`: every body on this surface is closed until asked for, which is a
// structural fact (there is no field to set) rather than a default somebody could flip per row.
//
// A COMMAND IS NOT HERE. Commands fold now — a real session ran thirty `find`/`grep`/`ls` lines
// whose text is longer than the prose around them — so the rows that stand alone are the FAILURES,
// of any kind. Every command's own line and output survive inside the fold, which the suite below
// this one is about.
const CALLS: readonly [string, ToolCall, Record<string, unknown>][] = [
  [
    'a failed command carries its output, which its mark says is worth opening',
    aCommand({ status: 'failed', result: anOutput('error TS2345') }),
    { kind: 'call', status: 'failed', output: { text: 'error TS2345' } },
  ],
  [
    'a failed read is loud too, and carries what it printed',
    aCall({ id: 'x', status: 'failed', result: anOutput('File does not exist.') }),
    { kind: 'call', callKind: 'read', status: 'failed' },
  ],
  [
    'a failed call that printed nothing still says it failed, with nothing to open',
    aCommand({ status: 'failed', result: null }),
    { kind: 'call', status: 'failed', output: null },
  ],
]

describe('a call that gets its own row', () => {
  it.each(CALLS)('%s', (_name, call, expected) => {
    expect(rowOf(call)).toMatchObject(expected)
  })
})

// FOLDING IS A COLLAPSE, NOT A DISCARD. A command that folds keeps everything the row it replaced
// carried — the line it ran, its status, and what it printed — because the fold's whole bargain is
// that opening it gives back the rows you would have had. A tally with no way to reach a build
// log's failures would be worse than the wall it replaced.
const FOLDED: readonly [string, ToolCall, Record<string, unknown>][] = [
  [
    'a command keeps the line it ran',
    aCommand({ result: anOutput(A_LOG) }),
    { target: 'bun run test', callKind: 'execute', status: 'completed' },
  ],
  // Length decides nothing. A column where a row's height depends on how much it happened to print
  // is a column you cannot skim, and skimming is the whole job of the feed.
  [
    'a short result is carried like any other, not shown by virtue of being short',
    aCommand({ result: anOutput('Set effort level to medium') }),
    { status: 'completed', output: { text: 'Set effort level to medium' } },
  ],
  // An expandable that opens onto nothing is a row that lied about having something behind it.
  [
    'a call that printed nothing carries no output rather than an empty one',
    aCommand({ result: null }),
    { output: null },
  ],
  // A command still running has printed nothing yet, and the row must not read as finished.
  [
    'a command still running keeps its running status',
    aCommand({ status: 'in_progress' }),
    { status: 'in_progress', output: null },
  ],
  [
    'a command the record named no line for keeps an absent target rather than a made-up one',
    aCommand({ target: null }),
    { target: null },
  ],
  // A command line has slashes in it and no filename to lift out, so it must never be read as a
  // path: split at its last separator, `… | head -50` would be presented as the file it named.
  [
    'a command is marked as NOT a path, whatever slashes its line contains',
    aCommand({ target: 'ls apps/desktop/src && head -50' }),
    { isPath: false },
  ],
]

describe('a command folded into a quiet run', () => {
  it.each(FOLDED)('%s', (_name, call, expected) => {
    const row = rowOf(call)
    expect(row).toMatchObject({ kind: 'quiet' })
    expect(row.kind === 'quiet' ? row.calls[0] : null).toMatchObject(expected)
  })

  it('counts commands under Argo\u2019s own verb rather than the kind name', () => {
    const row = rowOf(aCommand())
    expect(row.kind === 'quiet' ? row.counts : null).toEqual([{ word: 'ran', count: 1 }])
  })

  // The glyph is what would lie. A run holding a command is not observation — `ls` and `rm -rf`
  // are one kind to a transcript — so it must not render under a pair of binoculars.
  it('does not read a run holding a command as observation', () => {
    expect(rowOf(aCommand())).toMatchObject({ kind: 'quiet', observed: false })
  })
})

describe('a mutation that failed', () => {
  // A failed edit reports no patch, and "no diff available" alone hides the one thing worth reading:
  // WHY the change did not land. Open here rather than in the component, so "a failure shows what
  // went wrong" is one rule decided in one place for every row that can fail.
  it('opens what it printed, so the reason the change failed is on screen', () => {
    const row = rowOf(anEdit({ id: 'm', status: 'failed', result: anOutput('EACCES: denied') }))

    expect(row).toMatchObject({
      kind: 'mutation',
      status: 'failed',
      diff: null,
      output: { text: 'EACCES: denied' },
    })
  })

  it('carries no output where the change reported a patch instead', () => {
    const row = rowOf(anEdit({ id: 'm' }))

    expect(row).toMatchObject({
      kind: 'mutation',
      output: null,
      diff: { change: 'modify' },
    })
  })
})
