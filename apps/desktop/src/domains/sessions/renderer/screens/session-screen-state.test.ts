import { describe, expect, test } from 'bun:test'
import { DEFAULT_HARNESS, HARNESSES } from '@/harnesses/harness'
import { sessionHarness } from './session-screen-state'

// The default is the first Harness, so the second shows the Session's own Harness won.
const own = HARNESSES[1]
const chooseHarness = () => {}

describe('sessionHarness', () => {
  test('an open Session shows no Harness until its details load', () => {
    const control = sessionHarness({
      selectedSessionId: 'opened',
      lastHarness: own,
      chooseHarness,
      session: null,
      sent: null,
    })
    expect(control).toBeNull()
  })

  test('loaded details name the Harness', () => {
    const control = sessionHarness({
      selectedSessionId: 'opened',
      lastHarness: DEFAULT_HARNESS,
      chooseHarness,
      session: { harness: own },
      sent: null,
    })
    expect(control).toEqual({ harness: own })
  })

  test('a Session this window sent shows the sent Harness until its details load', () => {
    const control = sessionHarness({
      selectedSessionId: 'started',
      lastHarness: DEFAULT_HARNESS,
      chooseHarness,
      session: null,
      sent: {
        harness: own,
        turnConfiguration: { model: 'model', effort: 'medium', mode: 'default' },
      },
    })
    expect(control).toEqual({ harness: own })
  })
})
