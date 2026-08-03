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

  it('reads tool calls with the host name verbatim, resolving each on its result', () => {
    const [turn] = parseFixture('treeFull').tree.turns

    expect(turn.toolCalls).toEqual([
      {
        id: 'call-read',
        name: 'Read',
        kind: 'read',
        status: 'completed',
        target: 'src/main/observe/index.ts',
      },
      { id: 'call-todo', name: 'TodoWrite', kind: 'plan', status: 'completed', target: null },
      {
        id: 'call-task',
        name: 'Task',
        kind: 'delegate',
        status: 'pending',
        target: 'research: resume chains',
      },
      { id: 'call-bare', name: 'Task', kind: 'delegate', status: 'failed', target: null },
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

describe('the tree’s structural markers', () => {
  it('marks the compaction seam in front of the turn that follows it', () => {
    const { tree } = parseFixture('treeFull')

    expect(tree.compactions).toEqual([{ beforeTurnId: 't-turn-2' }])
    // The summary record is the seam, NOT a prompt: it opens no turn of its own.
    expect(tree.turns.map((turn) => turn.id)).toEqual(['t-turn-1', 't-turn-2'])
  })

  it('names a Subagent per delegating call, with label and group ABSENT when unreported', () => {
    const labelled = parseFixture('treeFull').tree.subagents
    const grouped = parseFixture('sidechain').tree.subagents

    expect(labelled).toEqual([
      { id: 'call-task', label: 'research: resume chains' },
      { id: 'call-bare' },
    ])
    // No phase is invented: only the CLI that reported one gets a `group`.
    expect('group' in labelled[0]).toBe(false)
    expect(grouped).toEqual([{ id: 's-call-task', label: 'verify: the seam', group: 'Verify' }])
  })

  it('leaves a Subagent’s own sidechain records out of the parent’s sequence', () => {
    const { tree } = parseFixture('sidechain')

    expect(tree.turns).toHaveLength(1)
    expect(tree.turns[0].toolCalls.map((call) => call.id)).toEqual(['s-call-task'])
  })

  it('yields no tree at all from an unparseable body, without throwing', () => {
    const parsed = parseFixture('unparseableBody')

    expect(parsed.tree).toEqual({ turns: [], compactions: [], subagents: [] })
    // The direct facts the head records carried survive: this is what keeps the row standing.
    expect(parsed.cwd).toBe('/Users/x/tree')
    expect(parsed.lastTimestampMs).not.toBeNull()
  })
})
