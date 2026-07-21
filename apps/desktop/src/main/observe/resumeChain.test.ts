import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTranscript } from './claudeTranscript'
import { stitch } from './resumeChain'

const parseFixture = (name: string) =>
  parseTranscript(
    name,
    readFileSync(join(__dirname, '__fixtures__', `${name}.jsonl`), 'utf8').split('\n'),
  )

describe('stitch', () => {
  it('joins a resume child onto its parent as one logical session, root → leaf, nothing re-keyed', () => {
    const parent = parseFixture('resumeParent')
    const child = parseFixture('resumeChild')

    const logical = stitch([child, parent])

    expect(logical).toHaveLength(1)
    expect(logical[0].id).toBe('resumeParent')
    expect(logical[0].fileIds).toEqual(['resumeParent', 'resumeChild'])
    expect(logical[0].files.map((file) => file.sessionId)).toEqual(['resumeParent', 'resumeChild'])
  })

  it('treats a self-pointing head as a root, yielding one single-file session', () => {
    const basic = parseFixture('externalBasic')
    const logical = stitch([basic])

    expect(logical).toHaveLength(1)
    expect(logical[0].id).toBe('externalBasic')
    expect(logical[0].fileIds).toEqual(['externalBasic'])
  })
})
