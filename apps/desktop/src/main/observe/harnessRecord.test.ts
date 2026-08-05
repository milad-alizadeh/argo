import { describe, expect, it } from 'vitest'
import { commandPrompt, isHarnessMeta, userPrompt } from './harnessRecord'

// The records in here are the shapes a real `/implement` run writes, kept literal: the reading
// under test is entirely about telling the CLI's own plumbing apart from a person's prompt, and a
// tidied-up sample would be a sample of the wrong thing.

describe('a record the harness wrote to itself', () => {
  it('is the CLI’s own flag, not a guess at the text', () => {
    expect(isHarnessMeta({ isMeta: true })).toBe(true)
    expect(isHarnessMeta({ isMeta: false })).toBe(false)
    // A CLI that sets no flag has no meta records — the honest floor, never inferred.
    expect(isHarnessMeta({})).toBe(false)
    expect(isHarnessMeta({ isMeta: 'true' })).toBe(false)
  })
})

describe('a slash command read as the user typed it', () => {
  it('joins the command to its arguments', () => {
    const raw =
      '<command-message>implement</command-message>\n' +
      '<command-name>/implement</command-name>\n' +
      '<command-args>318 open storybook while you do it</command-args>'

    expect(commandPrompt(raw)).toBe('/implement 318 open storybook while you do it')
  })

  it('is the bare command where the record carried no arguments', () => {
    const raw =
      '<command-name>/effort</command-name>\n' +
      '            <command-message>effort</command-message>\n' +
      '            <command-args></command-args>'

    expect(commandPrompt(raw)).toBe('/effort')
  })

  it('is absent for text that is not a command, so ordinary prose is never rewritten', () => {
    expect(commandPrompt('fix the spacing between turns')).toBeNull()
  })
})

describe('what a user record asks for', () => {
  it('is the text itself, unclamped and untrimmed', () => {
    const typed = '  fix the spacing\n\nand the titles  '

    expect(userPrompt([{ type: 'text', text: typed }])).toBe(typed)
  })

  it('is nothing for a local command’s own stdout', () => {
    const stdout =
      '<local-command-stdout>Set effort level to medium (saved as your default for new ' +
      'sessions): Balanced approach with standard implementation and testing</local-command-stdout>'

    expect(userPrompt(stdout)).toBeNull()
  })

  it('is nothing for a record with only whitespace in it', () => {
    expect(userPrompt([{ type: 'text', text: '   \n ' }])).toBeNull()
    expect(userPrompt([])).toBeNull()
  })

  it('steps over a blank part to the first one with words in it', () => {
    expect(
      userPrompt([
        { type: 'text', text: '  ' },
        { type: 'text', text: 'the ask' },
      ]),
    ).toBe('the ask')
  })

  it('reads a bare string body, which is the shape a paste arrives in', () => {
    expect(userPrompt('what changed?')).toBe('what changed?')
  })
})
