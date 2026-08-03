import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'

const parseFixture = (name: string) =>
  parseTranscript(
    name,
    readFileSync(join(__dirname, '__fixtures__', `${name}.jsonl`), 'utf8').split('\n'),
  )

// What the agent said and what it thought, kept apart. The feed reads both; conflating them would
// let a reader act on reasoning the agent went on to abandon.
describe('the prose inside a turn', () => {
  it('reads a `text` block as a Message and a `thinking` block as a Thought, in emission order', () => {
    const turn = parseFixture('prose').tree.turns[1]

    expect(turn.prose).toEqual([
      { kind: 'thought', markdown: 'first I weigh it' },
      { kind: 'message', markdown: 'It reads the transcript.' },
      { kind: 'thought', markdown: 'then I doubt it' },
    ])
  })

  it('skips a malformed prose part without throwing, and keeps its sound neighbours', () => {
    const turn = parseFixture('prose').tree.turns[2]

    // A non-string `text`, a `thinking` with no thinking, a `text` with no text: absent, not
    // defaulted to an empty paragraph that would render as a blank row.
    expect(turn.prose).toEqual([{ kind: 'message', markdown: 'survived the malformed neighbours' }])
  })

  it('carries the prompt that opened the turn verbatim, whitespace and all', () => {
    const { turns } = parseFixture('prose').tree

    expect(turns[1].prompt).toBe('    read this file\n\n      and keep my indentation')
    // Steering text is a prompt into the same sequence — no second concept for it.
    expect(turns[3].prompt).toBe('steered mid-run')
  })

  it('leaves the prompt absent where the record carried none rather than inventing one', () => {
    const { turns } = parseFixture('prose').tree

    // A chain resumed mid-turn: the assistant record opened the turn, so there is no prompt at all.
    expect(turns[0].prompt).toBeNull()
    // A prompt of nothing but whitespace is an absent fact too, not an empty paragraph.
    expect(turns[2].prompt).toBeNull()
  })

  it('reads a plain-string prompt, and never a tool_result or a compact summary as one', () => {
    const { turns } = parseFixture('treeFull').tree

    expect(turns.map((turn) => turn.prompt)).toEqual(['Wire the observer', 'Now grade the status'])
    expect(turns[0].prose).toEqual([
      { kind: 'thought', markdown: 'plan it' },
      { kind: 'message', markdown: 'Wired.' },
    ])
  })
})
