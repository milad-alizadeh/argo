import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'

const readFixtureLines = (name: string): string[] =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8').split('\n')

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
