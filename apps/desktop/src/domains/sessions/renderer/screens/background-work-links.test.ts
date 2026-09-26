import { expect, test } from 'bun:test'
import { sessionRow } from '../session-fixtures'
import type { SessionFeedRow } from '../types'
import { backgroundWorkLinks } from './background-work-links'
import { sessionScreenSubagents } from './session-screen-subagents'

test('opens the child Session named by a Feed subagent row', () => {
  const rows = [
    {
      shape: 'subagent',
      id: 'call-started',
      subagentId: 'agent-a64dd851fde47a6f0',
      event: 'started',
      name: 'Explore Turn Configuration and harness code for issue 2669',
    },
  ] satisfies SessionFeedRow[]
  const subagents = sessionScreenSubagents(rows, [])
  const selections: unknown[] = []
  const links = backgroundWorkLinks({
    pick: (selection) => selections.push(selection),
    selectedSessionId: 'parent-session',
    session: sessionRow({ id: 'parent-session', subagents: [], shell: [] }),
    subagents,
    subagentUsage: {},
  })
  const target = links.find({ callId: rows[0]?.subagentId ?? null, name: null })

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
