import { expect, test } from 'bun:test'
import { sessionSubagent } from '@/mocks/sessions/session-rows'
import { pickedSubagent, sessionScreenSubagents } from './session-screen-subagents'

const AGENT_ID = 'agent-a64dd851fde47a6f0'

test('uses a Subagent from the Feed as an inspector target when the Session index has no child', () => {
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

test('keeps indexed facts for a child already in the Session index, with the Feed state', () => {
  const indexedChild = sessionSubagent({
    id: AGENT_ID,
    label: 'Indexed name',
    startedAt: '2026-09-23T23:00:00.000Z',
  })
  expect(
    sessionScreenSubagents([{ id: AGENT_ID, label: 'Feed name', state: 'failed' }], [indexedChild]),
  ).toEqual([{ ...indexedChild, state: 'failed' }])
})

test('keeps the Feed name when the Session index stored none', () => {
  const indexedChild = sessionSubagent({ id: AGENT_ID, label: null })
  expect(
    sessionScreenSubagents(
      [{ id: AGENT_ID, label: 'Feed name', state: 'running' }],
      [indexedChild],
    ),
  ).toEqual([{ ...indexedChild, label: 'Feed name' }])
})

test('opens a Subagent the Session never listed with what its Feed row said', () => {
  const opened = {
    id: AGENT_ID,
    label: 'spec_review',
    nickname: 'Jason',
    state: 'running',
  } as const
  expect(pickedSubagent([], { subagentId: AGENT_ID, opened })).toEqual({
    ...opened,
    startedAt: null,
    endedAt: null,
  })
})

test('picks nothing for an id with no listing and no row', () => {
  expect(pickedSubagent([], { subagentId: AGENT_ID })).toBeNull()
})
