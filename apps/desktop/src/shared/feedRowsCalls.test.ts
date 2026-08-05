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
const CALLS: readonly [string, ToolCall, Record<string, unknown>][] = [
  [
    'a command shows the line it ran and holds its log behind a click',
    aCommand({ result: anOutput(A_LOG) }),
    { kind: 'call', callKind: 'execute', target: 'bun run test', status: 'completed' },
  ],
  // Length decides nothing. A column where a row's height depends on how much it happened to print
  // is a column you cannot skim, and skimming is the whole job of the feed.
  [
    'a short result is carried like any other, not shown by virtue of being short',
    aCommand({ result: anOutput('Set effort level to medium') }),
    { kind: 'call', status: 'completed', output: { text: 'Set effort level to medium' } },
  ],
  [
    'a failed command carries its output, which its mark and ring say is worth opening',
    aCommand({ status: 'failed', result: anOutput('error TS2345') }),
    { kind: 'call', status: 'failed', output: { text: 'error TS2345' } },
  ],
  [
    'a failed read is loud too, and carries what it printed',
    aCall({ id: 'x', status: 'failed', result: anOutput('File does not exist.') }),
    { kind: 'call', callKind: 'read', status: 'failed' },
  ],
  // An expandable that opens onto nothing is a row that lied about having something behind it.
  [
    'a call that printed nothing carries no output rather than an empty one',
    aCommand({ result: null }),
    { kind: 'call', output: null },
  ],
  [
    'a failed call that printed nothing still says it failed, with nothing to open',
    aCommand({ status: 'failed', result: null }),
    { kind: 'call', status: 'failed', output: null },
  ],
  // A command still running has printed nothing yet, and the row must not read as finished.
  [
    'a command still running keeps its running status',
    aCommand({ status: 'in_progress' }),
    { kind: 'call', status: 'in_progress', output: null },
  ],
  [
    'a command the record named no line for keeps an absent target rather than a made-up one',
    aCommand({ target: null }),
    { kind: 'call', target: null },
  ],
  // The host's own tool name travels verbatim beside the CLI-agnostic kind, so neither is renamed
  // away by the other.
  [
    'a call carries the host’s own tool name beside its kind',
    aCommand({ name: 'BashOutput' }),
    { kind: 'call', name: 'BashOutput', callKind: 'execute' },
  ],
]

describe('a call that gets its own row', () => {
  it.each(CALLS)('%s', (_name, call, expected) => {
    expect(rowOf(call)).toMatchObject(expected)
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
