import { expect, test } from 'bun:test'
import { sessionRow } from '../session-fixtures'
import { backgroundWorkLinks } from './background-work-links'
import { sessionScreenSubagents } from './session-screen-subagents'

test('opens the Subagent a Feed row names by id', () => {
  const subagents = sessionScreenSubagents(
    [
      {
        id: 'agent-a64dd851fde47a6f0',
        label: 'Explore Turn Configuration and harness code for issue 2669',
        state: 'running',
      },
    ],
    [],
  )
  const selections: unknown[] = []
  const links = backgroundWorkLinks({
    pick: (selection) => selections.push(selection),
    selectedSessionId: 'parent-session',
    session: sessionRow({ id: 'parent-session', subagents: [], shell: [] }),
    subagents,
    subagentUsage: {},
  })
  const target = links.find('agent-a64dd851fde47a6f0')

  expect(target).toMatchObject({
    kind: 'delegation',
    delegation: {
      id: 'agent-a64dd851fde47a6f0',
      label: 'Explore Turn Configuration and harness code for issue 2669',
    },
  })
  if (target !== null) links.open(target)
  expect(selections).toEqual([
    { sessionId: 'parent-session', subagentId: 'agent-a64dd851fde47a6f0', shellId: null },
  ])
})

test('never matches a Subagent by its displayed name', () => {
  const links = backgroundWorkLinks({
    pick: () => {},
    selectedSessionId: 'parent-session',
    session: sessionRow({ id: 'parent-session', subagents: [], shell: [] }),
    subagents: sessionScreenSubagents([{ id: 'agent-1', label: 'Review', state: 'running' }], []),
    subagentUsage: {},
  })
  expect(links.find('Review')).toBeNull()
})
