import { describe, expect, test } from 'bun:test'
import { formatSkillLabel, parsePromptText } from './prompt-segments'

describe('splitting a prompt into skill, link, and text segments', () => {
  test('reads a skill mention as its own segment', () => {
    const text = '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md)'
    expect(parsePromptText(text)).toEqual([
      {
        kind: 'skill',
        name: 'implement',
        path: '/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md',
      },
    ])
  })

  test('reads a markdown-wrapped URL as a link', () => {
    const text =
      '[https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)'
    expect(parsePromptText(text)).toEqual([
      {
        kind: 'link',
        href: 'https://github.com/milad-alizadeh/argo/issues/1944',
        label: 'https://github.com/milad-alizadeh/argo/issues/1944',
      },
    ])
  })

  test('reads a bare URL as a link', () => {
    expect(parsePromptText('See https://example.com/notes for detail.')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', href: 'https://example.com/notes', label: 'https://example.com/notes' },
      { kind: 'text', value: ' for detail.' },
    ])
  })

  test('reads a skill mention followed by a link, from the reported bug', () => {
    const text =
      '[$implement](/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md) [https://github.com/milad-alizadeh/argo/issues/1944](https://github.com/milad-alizadeh/argo/issues/1944)'
    expect(parsePromptText(text)).toEqual([
      {
        kind: 'skill',
        name: 'implement',
        path: '/Users/milad/Developer/argo/.agents/skills/implement/SKILL.md',
      },
      { kind: 'text', value: ' ' },
      {
        kind: 'link',
        href: 'https://github.com/milad-alizadeh/argo/issues/1944',
        label: 'https://github.com/milad-alizadeh/argo/issues/1944',
      },
    ])
  })

  test('leaves plain text untouched', () => {
    expect(parsePromptText('Review the new Session shell.')).toEqual([
      { kind: 'text', value: 'Review the new Session shell.' },
    ])
  })

  test('keeps a non-external markdown link as plain text', () => {
    expect(parsePromptText('See [the note](docs/note.md) first.')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'text', value: 'the note' },
      { kind: 'text', value: ' first.' },
    ])
  })

  test('reads a labelled markdown link', () => {
    expect(parsePromptText('Read [the ticket](https://example.com/ticket) now.')).toEqual([
      { kind: 'text', value: 'Read ' },
      { kind: 'link', href: 'https://example.com/ticket', label: 'the ticket' },
      { kind: 'text', value: ' now.' },
    ])
  })
})

describe('turning a skill slug into a readable label', () => {
  test('capitalises a single-word slug', () => {
    expect(formatSkillLabel('implement')).toBe('Implement')
  })

  test('turns a hyphenated slug into separate words', () => {
    expect(formatSkillLabel('frontend-design')).toBe('Frontend Design')
  })

  test('turns an underscored slug into separate words', () => {
    expect(formatSkillLabel('grill_me')).toBe('Grill Me')
  })
})
