import { describe, expect, it } from 'vitest'
import { aCall, anAgent, anEdit, anOutput, aTurn } from './__fixtures__/tree'
import { feedRows } from './feedRows'
import type { ToolCall } from './runtimeTree'

// The rows a single call gets: a command, which always shows the line it ran, and a failure of any
// kind, which shows what went wrong without a click.

const rowOf = (call: ToolCall) => feedRows(anAgent([aTurn({ id: 't1', toolCalls: [call] })]))[0]

const aCommand = (over: Partial<ToolCall> = {}): ToolCall =>
  aCall({ id: 'x', name: 'Bash', kind: 'execute', target: 'bun run test', ...over })

// `open` is the DERIVATION's decision, not the component's — which is what keeps "a failure shows
// what went wrong" a test rather than a screenshot.
const CALLS: readonly [string, ToolCall, Record<string, unknown>][] = [
  [
    'a command shows the line it ran and keeps its output closed',
    aCommand({ result: anOutput('12 pass') }),
    { kind: 'call', callKind: 'execute', target: 'bun run test', status: 'completed', open: false },
  ],
  [
    'a failed command opens its output, because the thing that went wrong is the thing you see',
    aCommand({ status: 'failed', result: anOutput('error TS2345') }),
    { kind: 'call', status: 'failed', output: { text: 'error TS2345' }, open: true },
  ],
  [
    'a failed read is loud too, and opens what it printed',
    aCall({ id: 'x', status: 'failed', result: anOutput('File does not exist.') }),
    { kind: 'call', callKind: 'read', status: 'failed', open: true },
  ],
  // An expandable that opens onto nothing is a row that lied about having something behind it.
  [
    'a call that printed nothing carries no output rather than an empty one',
    aCommand({ result: null }),
    { kind: 'call', output: null, open: false },
  ],
  [
    'a failed call that printed nothing still says it failed, with nothing to open',
    aCommand({ status: 'failed', result: null }),
    { kind: 'call', status: 'failed', output: null, open: true },
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
      open: true,
    })
  })

  it('carries no output where the change reported a patch instead', () => {
    const row = rowOf(anEdit({ id: 'm' }))

    expect(row).toMatchObject({
      kind: 'mutation',
      output: null,
      open: false,
      diff: { change: 'modify' },
    })
  })
})
