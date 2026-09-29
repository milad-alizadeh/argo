import { expect, test } from 'bun:test'
import { backgroundWorkLinks } from './background-work-links'

test('opens the Subagent a Feed row names by id, never by its displayed name', () => {
  const selections: unknown[] = []
  const links = backgroundWorkLinks({
    pick: (selection) => selections.push(selection),
    selectedSessionId: 'parent-session',
  })
  const opened = { id: 'agent-a64dd851fde47a6f0', label: 'Review', state: 'running' } as const
  links.open(opened)
  expect(selections).toEqual([
    { sessionId: 'parent-session', subagentId: 'agent-a64dd851fde47a6f0', shellId: null, opened },
  ])
})
