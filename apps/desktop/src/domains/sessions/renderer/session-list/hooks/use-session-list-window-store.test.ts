import { beforeEach, describe, expect, test } from 'bun:test'

import { useSessionListWindowStore } from './use-session-list-window-store'

beforeEach(() => {
  useSessionListWindowStore.setState(useSessionListWindowStore.getInitialState())
})

describe('the Session list window', () => {
  test('grows to the cursor the last reply carried', () => {
    useSessionListWindowStore.getState().grow('/repo', '{"claude":"100"}')
    expect(useSessionListWindowStore.getState().cursors['/repo']).toBe('{"claude":"100"}')
  })

  test('keeps each project scope at its own window', () => {
    useSessionListWindowStore.getState().grow('/repo', '{"claude":"100"}')
    expect(useSessionListWindowStore.getState().cursors['/other']).toBeUndefined()
  })

  test('holds the unscoped window apart from every project', () => {
    useSessionListWindowStore.getState().grow(null, '{"claude":"100"}')
    expect(useSessionListWindowStore.getState().cursors['/repo']).toBeUndefined()
  })
})

describe('the remembered Session list order', () => {
  // The order used to live in a ref inside the sidebar, so unmounting the sidebar forgot it and the
  // list resorted itself into read order, which is most-recently-written first.
  test('outlives the component that drew it', () => {
    useSessionListWindowStore.getState().remember('/repo', ['session-a', 'session-b'])
    expect(useSessionListWindowStore.getState().orders['/repo']).toEqual(['session-a', 'session-b'])
  })

  test('leaves the state alone when the order it is handed has not changed', () => {
    useSessionListWindowStore.getState().remember('/repo', ['session-a', 'session-b'])
    const before = useSessionListWindowStore.getState()
    before.remember('/repo', ['session-a', 'session-b'])
    expect(useSessionListWindowStore.getState()).toBe(before)
  })

  test('records a new order when one Session has been added', () => {
    useSessionListWindowStore.getState().remember('/repo', ['session-a'])
    useSessionListWindowStore.getState().remember('/repo', ['session-a', 'session-b'])
    expect(useSessionListWindowStore.getState().orders['/repo']).toEqual(['session-a', 'session-b'])
  })

  test('keeps each project scope in its own order', () => {
    useSessionListWindowStore.getState().remember('/repo', ['session-a'])
    useSessionListWindowStore.getState().remember('/other', ['session-b'])
    expect(useSessionListWindowStore.getState().orders['/repo']).toEqual(['session-a'])
  })
})
