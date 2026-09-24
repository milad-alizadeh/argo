import { expect, test } from 'bun:test'
import { sessionSubagent } from '../session-fixtures'
import type { SessionFeedRow } from '../types'
import { sessionScreenSubagents } from './session-screen-subagents'

test('uses a Feed subagent event as an inspector target when the roster has no child', () => {
  const rows = [
    {
      shape: 'subagent',
      id: 'call-started',
      subagentId: 'agent-a64dd851fde47a6f0',
      event: 'started',
      name: 'Explore turn setup and harness code for issue 2669',
    },
  ] satisfies SessionFeedRow[]

  expect(sessionScreenSubagents(rows, [])).toEqual([
    {
      id: 'agent-a64dd851fde47a6f0',
      label: 'Explore turn setup and harness code for issue 2669',
      state: 'running',
      startedAt: null,
      endedAt: null,
    },
  ])
})

test('keeps roster facts authoritative for a child already in the roster', () => {
  const rosterChild = sessionSubagent({
    id: 'agent-a64dd851fde47a6f0',
    label: 'Roster name',
    startedAt: '2026-09-23T23:00:00.000Z',
  })
  const rows = [
    {
      shape: 'subagent',
      id: 'call-started',
      subagentId: rosterChild.id,
      event: 'responded',
      state: 'failed',
      name: 'Feed name',
    },
  ] satisfies SessionFeedRow[]

  expect(sessionScreenSubagents(rows, [rosterChild])).toEqual([rosterChild])
})
