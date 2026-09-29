import { expect, test } from 'bun:test'
import { sessionSubagent } from '../session-fixtures'
import { pickedSubagent, sessionScreenSubagents } from './session-screen-subagents'

const AGENT_ID = 'agent-a64dd851fde47a6f0'

test('uses a Subagent from the Feed as an inspector target when the roster has no child', () => {
  expect(
    sessionScreenSubagents([{ id: AGENT_ID, label: 'Explore the harness', state: 'running' }], []),
  ).toEqual([
    {
      id: AGENT_ID,
      label: 'Explore the harness',
      state: 'running',
      startedAt: null,
      endedAt: null,
    },
  ])
})

test('keeps roster facts for a child already in the roster, with the Feed state', () => {
  const rosterChild = sessionSubagent({
    id: AGENT_ID,
    label: 'Roster name',
    startedAt: '2026-09-23T23:00:00.000Z',
  })
  expect(
    sessionScreenSubagents([{ id: AGENT_ID, label: 'Feed name', state: 'failed' }], [rosterChild]),
  ).toEqual([{ ...rosterChild, state: 'failed' }])
})

test('keeps the Feed name when the roster stored none', () => {
  const rosterChild = sessionSubagent({ id: AGENT_ID, label: null })
  expect(
    sessionScreenSubagents([{ id: AGENT_ID, label: 'Feed name', state: 'running' }], [rosterChild]),
  ).toEqual([{ ...rosterChild, label: 'Feed name' }])
})

test('opens a Subagent the Session never listed, as ended with no label', () => {
  expect(pickedSubagent([], AGENT_ID)).toEqual({
    id: AGENT_ID,
    label: null,
    state: 'completed',
    startedAt: null,
    endedAt: null,
  })
})
