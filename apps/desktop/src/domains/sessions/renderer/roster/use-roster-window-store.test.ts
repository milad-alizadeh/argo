import { beforeEach, describe, expect, test } from 'bun:test'

import { useRosterWindowStore } from '@/domains/sessions/renderer/roster/use-roster-window-store'

beforeEach(() => {
  useRosterWindowStore.setState(useRosterWindowStore.getInitialState())
})

describe('the roster window', () => {
  test('grows to the cursor the last reply carried', () => {
    useRosterWindowStore.getState().grow('/repo', '{"claude":"100"}')
    expect(useRosterWindowStore.getState().cursors['/repo']).toBe('{"claude":"100"}')
  })

  test('keeps each project scope at its own window', () => {
    useRosterWindowStore.getState().grow('/repo', '{"claude":"100"}')
    expect(useRosterWindowStore.getState().cursors['/other']).toBeUndefined()
  })

  test('holds the unscoped window apart from every project', () => {
    useRosterWindowStore.getState().grow(null, '{"claude":"100"}')
    expect(useRosterWindowStore.getState().cursors['/repo']).toBeUndefined()
  })
})

describe('the remembered roster order', () => {
  // The order used to live in a ref inside the sidebar, so unmounting the sidebar forgot it and the
  // list resorted itself into read order, which is most-recently-written first.
  test('outlives the component that drew it', () => {
    useRosterWindowStore.getState().remember('/repo', ['session-a', 'session-b'])
    expect(useRosterWindowStore.getState().orders['/repo']).toEqual(['session-a', 'session-b'])
  })

  test('leaves the state alone when the order it is handed has not changed', () => {
    useRosterWindowStore.getState().remember('/repo', ['session-a', 'session-b'])
    const before = useRosterWindowStore.getState()
    before.remember('/repo', ['session-a', 'session-b'])
    expect(useRosterWindowStore.getState()).toBe(before)
  })

  test('records a new order when one Session has been added', () => {
    useRosterWindowStore.getState().remember('/repo', ['session-a'])
    useRosterWindowStore.getState().remember('/repo', ['session-a', 'session-b'])
    expect(useRosterWindowStore.getState().orders['/repo']).toEqual(['session-a', 'session-b'])
  })

  test('keeps each project scope in its own order', () => {
    useRosterWindowStore.getState().remember('/repo', ['session-a'])
    useRosterWindowStore.getState().remember('/other', ['session-b'])
    expect(useRosterWindowStore.getState().orders['/repo']).toEqual(['session-a'])
  })
})
