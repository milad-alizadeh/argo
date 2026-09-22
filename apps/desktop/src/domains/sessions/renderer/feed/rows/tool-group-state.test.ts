import { expect, test } from 'bun:test'
import { ToolGroupState } from './tool-group-state'

test('notifies only the tool group whose disclosure changed', () => {
  const state = new ToolGroupState()
  let firstUpdates = 0
  let secondUpdates = 0
  const unsubscribeFirst = state.subscribe('first', () => {
    firstUpdates += 1
  })
  state.subscribe('second', () => {
    secondUpdates += 1
  })

  state.setOpen('first', true)
  state.setOpen('first', true)
  state.setOpen('second', true)
  unsubscribeFirst()
  state.setOpen('first', false)

  expect(firstUpdates).toBe(1)
  expect(secondUpdates).toBe(1)
})
