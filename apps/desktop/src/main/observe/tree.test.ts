import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'

const parseFixture = (name: string) =>
  parseTranscript(
    name,
    readFileSync(join(__dirname, '__fixtures__', `${name}.jsonl`), 'utf8').split('\n'),
  )

describe('the runtime tree folded out of one transcript', () => {
  it('segments prompt-in → stop-reason-out, ending an unattributable turn on `unknown`', () => {
    const { tree } = parseFixture('stopUnknown')

    // `stop_sequence` has no ACP counterpart, `max_tokens` does, and the last two turns simply
    // stop being spoken for — one because a new prompt superseded it, one because the file ended.
    expect(tree.turns.map((turn) => turn.stopReason)).toEqual([
      'unknown',
      'max_tokens',
      'unknown',
      null,
    ])
  })

  it('lifts the Plan off TodoWrite and drops an entry with no text', () => {
    const [turn] = parseFixture('treeFull').tree.turns

    expect(turn.plan).toEqual({
      entries: [
        { text: 'Read the observer', status: 'completed' },
        { text: 'Tail the transcripts', status: 'in_progress' },
        { text: 'Grade the status', status: 'pending' },
      ],
    })
  })

  it('sums usage over the turn and leaves it null where the record carries none', () => {
    const { tree } = parseFixture('treeFull')

    expect(tree.turns[0].usage).toEqual({
      inputTokens: 130,
      outputTokens: 45,
      cacheReadTokens: 900,
      cacheCreationTokens: 30,
    })
    expect(tree.turns[1].usage).toBeNull()
  })
})
