import { describe, expect, it } from 'vitest'
import { toolCallKind } from './toolCalls'

// Which coarse KIND a host's tool name reads as. The name itself always travels verbatim beside it;
// this is the CLI-agnostic reading the feed's loud/quiet matrix is driven by, so a name missing from
// the table is not a cosmetic gap — it decides whether the call gets a row or is folded away.

describe('the tools whose effect is known', () => {
  it.each([
    ['Read', 'read'],
    ['Edit', 'edit'],
    ['Write', 'edit'],
    ['Bash', 'execute'],
    ['Grep', 'search'],
    ['WebFetch', 'fetch'],
    ['Task', 'delegate'],
    ['TodoWrite', 'plan'],
  ])('reads %s as %s', (name, kind) => {
    expect(toolCallKind(name)).toBe(kind)
  })
})

// These fell to `other` and were folded into the quiet run, so entering a worktree — which creates
// one on disk — rendered under a glyph saying the agent had looked at something.
describe('the tools that CHANGE something', () => {
  it.each(['EnterWorktree', 'ExitWorktree', 'Skill'])('keeps %s out of the quiet fold', (name) => {
    expect(toolCallKind(name)).toBe('execute')
  })

  // `execute` and not `edit`: none of them reports a patch, and `execute` is the kind whose effect
  // the record does not describe — loud without claiming to know what it did.
  it('does not claim a worktree call produced a patch', () => {
    expect(toolCallKind('EnterWorktree')).not.toBe('edit')
  })
})

describe('the tools that look something up', () => {
  it('reads a tool search as a search, which is what it is', () => {
    expect(toolCallKind('ToolSearch')).toBe('search')
  })
})

describe('a name the table does not know', () => {
  it('reads as `other`, never as a guessed kind', () => {
    expect(toolCallKind('SomeToolShippedNextWeek')).toBe('other')
  })

  // MCP tools are user-installed and unbounded. Pattern-matching that namespace into kinds would be
  // guessing at scale, so they stay `other` — and the feed renders `other` under a neutral mark
  // rather than under one claiming observation, which is what makes the honest gap survivable.
  it('leaves the MCP namespace unclassified rather than guessing at it', () => {
    expect(toolCallKind('mcp__claude-in-chrome__navigate')).toBe('other')
    expect(toolCallKind('mcp__linear__list_issues')).toBe('other')
  })
})
