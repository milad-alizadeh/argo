import { describe, expect, test } from 'bun:test'
import { DEFAULT_HARNESS, HARNESSES } from '@/harnesses/harness'
import { sessionHarness } from './session-screen-state'

// The default is the first Harness, so the second is one the reader picked.
const picked = HARNESSES[1]
const chooseHarness = () => {}

describe('sessionHarness', () => {
  test('a Session keeps its known Harness until its details load', () => {
    const control = sessionHarness({
      selectedSessionId: 'started',
      lastHarness: picked,
      chooseHarness,
      session: null,
      knownHarness: picked,
    })
    expect(control).toEqual({ harness: picked })
  })

  test('loaded details name the Harness', () => {
    const control = sessionHarness({
      selectedSessionId: 'started',
      lastHarness: DEFAULT_HARNESS,
      chooseHarness,
      session: { harness: picked },
      knownHarness: DEFAULT_HARNESS,
    })
    expect(control).toEqual({ harness: picked })
  })
})
