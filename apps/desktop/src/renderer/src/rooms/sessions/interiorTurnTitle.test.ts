import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, aTurn as turn } from './__fixtures__/runtimeTree'
import { buildActivity } from './interiorActivity'

// What NAMES an exchange: the prompt that opened it. `Turn 7` says where you are, not what happened
// there. Its own file because the title is one rule read by two surfaces — the timeline row and the
// feed's section head — and both readings are judged here.

const rootWith = (turns: Turn[]): Agent => aRoot({ turns })

const titleOf = (prompt: string | null): string | null =>
  buildActivity(sessionView({ id: 's', agents: [rootWith([turn({ id: 't', prompt })])] })).turns[0]
    ?.promptLine ?? null

describe("a turn's title", () => {
  it('is the opening line of the prompt that caused it, verbatim', () => {
    expect(titleOf('Pull the rotation out of legacy auth\nand keep the export')).toBe(
      'Pull the rotation out of legacy auth',
    )
  })

  // An absent prompt is an absent fact — the card falls back to its ordinal rather than to prose
  // Argo wrote.
  it('is absent where the record carried no prompt', () => {
    expect(titleOf(null)).toBeNull()
  })

  // A prompt that is only whitespace has no line in it to keep, and a blank title would render as a
  // card that lost its name rather than as one that never had one.
  it('is absent where the prompt is whitespace alone', () => {
    expect(titleOf('  \n\n')).toBeNull()
  })
})

describe('the prompt row under that title', () => {
  const rowsOf = (prompt: string): readonly string[] => {
    const item = buildActivity(
      sessionView({
        id: 's',
        agents: [
          rootWith([turn({ id: 't', prompt, prose: [{ kind: 'message', markdown: 'wired' }] })]),
        ],
      }),
    ).own[0]
    return item?.kind === 'turn' ? item.rows.map(({ kind }) => kind) : []
  }

  // The section's HEAD is the prompt, so repeating it as the first row under itself prints one fact
  // twice an inch apart.
  it('drops out where the head already tells the whole prompt', () => {
    expect(rowsOf('wire it')).toEqual(['message'])
  })

  // The head shows one LINE, so a prompt with more in it than that line is only readable in the
  // feed. Dropping it there would lose text no other surface carries.
  it('stays where the prompt runs past the line the head shows', () => {
    expect(rowsOf('wire it\nand keep the export')).toEqual(['prompt', 'message'])
  })
})
