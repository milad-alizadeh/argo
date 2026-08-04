import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'
import { outputResultFrom } from './toolOutput'

// What a call PRINTED, read off the `tool_result` part that answered it. The shapes below are what
// Claude Code actually writes: a plain string most of the time, and an array of content parts when
// the result carried more than prose.

const OUTPUTS: readonly [string, unknown, string | null][] = [
  ['a string result is the output, verbatim', '12 pass\n0 fail', '12 pass\n0 fail'],
  [
    'the text parts of a multi-part result are joined in order',
    [
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ],
    'first\nsecond',
  ],
  // An image part is media, which is a later ticket's row. Reading it as prose would put a base64
  // blob on screen as if the agent had printed one.
  [
    'a non-text part is left for the kind that owns it',
    [
      { type: 'image', source: { data: 'iVBOR' } },
      { type: 'text', text: 'looked' },
    ],
    'looked',
  ],
  // A call that printed nothing is not a call with an empty output: a row with nothing to expand
  // must say so rather than opening onto a blank block.
  ['whitespace alone is no output at all', '   \n  ', null],
  ['a result the record carried nothing for has no output', undefined, null],
  ['a result of a shape this cannot read has no output', 42, null],
  ['an array with no text part in it has no output', [{ type: 'tool_reference' }], null],
]

describe('what a call printed', () => {
  it.each(OUTPUTS)('%s', (_name, content, expected) => {
    const result = outputResultFrom(content)

    expect(result?.text ?? null).toBe(expected)
  })

  it('grades a verbatim read off the record as direct', () => {
    expect(outputResultFrom('ok')).toEqual({ kind: 'output', tier: 'direct', text: 'ok' })
  })
})

const CALLS = parseTranscript(
  'commands',
  readFileSync(join(__dirname, '__fixtures__', 'commands.jsonl'), 'utf8').split('\n'),
).tree.turns[0].toolCalls

const resultOf = (id: string) => CALLS.find((call) => call.id === id)?.result ?? null

// Output is kept only where a ROW reads it. A successful read's output is the whole file, and the
// quiet row it folds into never shows one — holding every file a session read would be the feed's
// largest cost for a payload nothing renders.
const KEPT: readonly [string, string, string | null][] = [
  ['a command keeps what it printed', 'call-bash-ok', '12 pass\n0 fail'],
  ['a command that printed nothing keeps no output', 'call-bash-quiet', null],
  ['a failed command keeps what it printed', 'call-bash-bad', 'src/x.ts(4,1): error TS2345'],
  ['a failed read keeps what went wrong', 'call-read-bad', 'File does not exist.'],
  [
    'a failed mutation with no patch falls back to what it printed',
    'call-write-bad',
    'EACCES: permission denied',
  ],
  [
    'a successful read keeps nothing — the quiet row it folds into shows none',
    'call-read-ok',
    null,
  ],
]

describe('which calls carry their output through the parse', () => {
  it.each(KEPT)('%s', (_name, id, expected) => {
    const result = resultOf(id)

    expect(result === null || result.kind !== 'output' ? null : result.text).toBe(expected)
  })
})
