import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'

// The segmentation over a transcript full of the CLI's own plumbing. `harnessNoise.jsonl` is the
// shape a real `/implement` run writes: a caveat, two slash commands, a command's stdout, a skill's
// expanded body, and an `[Image: …]` paste preamble — five records that are not prompts, wrapped
// around two exchanges that are.

const parsed = (): ReturnType<typeof parseTranscript> =>
  parseTranscript(
    'harnessNoise',
    readFileSync(join(__dirname, '__fixtures__', 'harnessNoise.jsonl'), 'utf8').split('\n'),
  )

describe('turns segmented over a transcript of harness plumbing', () => {
  it('opens a turn only where something was actually asked for', () => {
    // Three prompts in ten records. Read naively this file is six turns, four of them empty.
    expect(parsed().tree.turns.map((turn) => turn.prompt)).toEqual([
      '/effort',
      '/implement 318 open storybook while you do it',
      'the spacing is off',
    ])
  })

  it('files a local command’s stdout as what that command produced', () => {
    const [effort] = parsed().tree.turns

    // The `/effort` turn's ENTIRE content is this line. Dropped, the turn shows the question and
    // never the answer; filed as prose, the CLI's words become the agent's.
    expect(effort.prose).toEqual([])
    expect(effort.toolCalls).toHaveLength(1)
    expect(effort.toolCalls[0]).toMatchObject({
      kind: 'execute',
      status: 'completed',
      target: '/effort',
      result: { kind: 'output', tier: 'derived', text: 'Set effort level to medium' },
    })
  })

  it('keeps the work under the prompt it belongs to rather than under the skill body', () => {
    const [, implement, spacing] = parsed().tree.turns

    // The skill body sits BETWEEN the `/implement` prompt and the agent's reply. Read as a prompt
    // it would take the reply with it, leaving `/implement` empty and titling the exchange
    // `Base directory for this skill: …`.
    expect(implement.prose.map((part) => part.markdown)).toEqual([
      "I'll start by reading the ticket.",
      'Done.',
    ])
    // One ordered sequence, the two kinds distinct within it — the order is what says which
    // reasoning produced which answer.
    expect(spacing.prose).toEqual([
      { kind: 'thought', markdown: 'The gap is asymmetric.' },
      { kind: 'message', markdown: 'Fixed.' },
    ])
  })

  it('drops a thinking block with nothing in it, and keeps one with words', () => {
    const [, implement, spacing] = parsed().tree.turns

    // A model whose reasoning is encrypted writes `thinking` out empty. Kept, each one is a
    // collapsed row whose one line is blank.
    expect(implement.prose.filter((part) => part.kind === 'thought')).toEqual([])
    expect(spacing.prose.filter((part) => part.kind === 'thought')).toEqual([
      { kind: 'thought', markdown: 'The gap is asymmetric.' },
    ])
  })

  it('titles the session from the first real prompt, not the caveat above it', () => {
    expect(parsed().firstPrompt).toBe('/effort')
  })
})
