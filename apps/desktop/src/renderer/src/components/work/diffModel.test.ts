import { describe, expect, it } from 'vitest'
import { findingBodyStub } from './diffModel'

describe('findingBodyStub', () => {
  it('cuts a long body to the stub length and ellipsises it', () => {
    const body = 'a'.repeat(80)
    expect(findingBodyStub(body)).toBe(`${'a'.repeat(46)}…`)
  })

  it('ellipsises a short body too — the stub is a pointer, not the whole sentence', () => {
    expect(findingBodyStub('short')).toBe('short…')
  })
})
