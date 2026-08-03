import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'

const readFixtureLines = (name: string): string[] =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8').split('\n')

const linesOf = (...records: unknown[]): string[] => records.map((record) => JSON.stringify(record))

const assistantRecord = (over: Record<string, unknown>): Record<string, unknown> => ({
  type: 'assistant',
  uuid: 'u-a',
  timestamp: '2026-07-20T10:00:00.000Z',
  ...over,
})

describe('parseTranscript', () => {
  it('extracts the head pointer, cwd, first prompt and recency from a root file', () => {
    const parsed = parseTranscript('externalBasic', readFixtureLines('externalBasic.jsonl'))

    expect(parsed.sessionId).toBe('externalBasic')
    expect(parsed.headLeafUuid).toBe('u-root-1')
    expect(parsed.cwd).toBe('/Users/x/proj')
    expect(parsed.aiTitle).toBeNull()
    expect(parsed.firstPrompt).toBe('Refactor the auth module')
    expect(parsed.lastTimestampMs).toBe(Date.parse('2026-07-20T10:00:05.000Z'))
  })

  it('collects every record uuid for resume-chain matching', () => {
    const parsed = parseTranscript('externalBasic', readFixtureLines('externalBasic.jsonl'))
    expect(parsed.messageUuids).toContain('u-root-1')
    expect(parsed.messageUuids).toContain('u-user-1')
    expect(parsed.messageUuids).toContain('u-asst-1')
  })

  it('skips a malformed line instead of throwing, and ignores unknown record types', () => {
    expect(() =>
      parseTranscript('externalBasic', readFixtureLines('externalBasic.jsonl')),
    ).not.toThrow()
    const parsed = parseTranscript('externalBasic', readFixtureLines('externalBasic.jsonl'))
    // The `mode` record's uuid is ignored — only real message records feed the chain.
    expect(parsed.messageUuids).not.toContain('u-mode-1')
  })

  it('takes a child file head pointer that lives in another file', () => {
    const parsed = parseTranscript('resumeChild', readFixtureLines('resumeChild.jsonl'))
    expect(parsed.headLeafUuid).toBe('p-asst-1')
    expect(parsed.messageUuids).not.toContain('p-asst-1')
  })

  it('never lifts a prose commit claim into a DIRECT field — no ai-title means no title fact', () => {
    const parsed = parseTranscript(
      'adversarialNoCommit',
      readFixtureLines('adversarialNoCommit.jsonl'),
    )
    expect(parsed.aiTitle).toBeNull()
    expect(parsed.firstPrompt).toBe('Fix the bug')
  })
})

describe('parseTranscript reads the model and branch', () => {
  it('takes the model from the LATEST assistant record, so a mid-run switch wins', () => {
    const parsed = parseTranscript(
      's',
      linesOf(
        assistantRecord({ message: { model: 'claude-sonnet-4-5' } }),
        assistantRecord({ uuid: 'u-b', message: { model: 'claude-opus-5' } }),
      ),
    )

    expect(parsed.model).toBe('claude-opus-5')
  })

  it('takes the branch from the latest record carrying one', () => {
    const parsed = parseTranscript(
      's',
      linesOf(
        { type: 'user', uuid: 'u-1', gitBranch: 'main', message: { content: 'go' } },
        assistantRecord({ gitBranch: 'argo/#267' }),
      ),
    )

    expect(parsed.gitBranch).toBe('argo/#267')
  })

  it('keeps an earlier branch reading when a later record carries none', () => {
    const parsed = parseTranscript(
      's',
      linesOf(assistantRecord({ gitBranch: 'main' }), assistantRecord({ uuid: 'u-b' })),
    )

    expect(parsed.gitBranch).toBe('main')
  })

  it('never invents either when no record reports them', () => {
    const parsed = parseTranscript('s', linesOf(assistantRecord({ message: { content: [] } })))

    expect(parsed.model).toBeNull()
    expect(parsed.gitBranch).toBeNull()
  })

  it('ignores a non-string model or branch rather than coercing it', () => {
    const parsed = parseTranscript(
      's',
      linesOf(assistantRecord({ gitBranch: { name: 'main' }, message: { model: 42 } })),
    )

    expect(parsed.model).toBeNull()
    expect(parsed.gitBranch).toBeNull()
  })

  it('reads a model past a malformed line instead of throwing', () => {
    const lines = [
      '{not valid json',
      ...linesOf(assistantRecord({ gitBranch: 'main', message: { model: 'claude-opus-5' } })),
    ]

    expect(() => parseTranscript('s', lines)).not.toThrow()
    const parsed = parseTranscript('s', lines)
    expect(parsed.model).toBe('claude-opus-5')
    expect(parsed.gitBranch).toBe('main')
  })

  it('reads the branch off a real transcript fixture', () => {
    const parsed = parseTranscript('externalBasic', readFixtureLines('externalBasic.jsonl'))

    expect(parsed.gitBranch).toBe('main')
    expect(parsed.model).toBe('claude-opus-5')
  })
})
