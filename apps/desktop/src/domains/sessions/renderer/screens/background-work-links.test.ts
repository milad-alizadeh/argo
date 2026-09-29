import { expect, test } from 'bun:test'
import { sessionRow } from '../session-fixtures'
import { backgroundWorkLinks } from './background-work-links'

function linksFor(shell: Parameters<typeof sessionRow>[0]['shell']) {
  const selections: unknown[] = []
  const links = backgroundWorkLinks({
    pick: (selection) => selections.push(selection),
    selectedSessionId: 'parent-session',
    session: sessionRow({ id: 'parent-session', subagents: [], shell }),
  })
  return { links, selections }
}

test('opens the Subagent a Feed row names by id', () => {
  const { links, selections } = linksFor([])
  links.open('agent-a64dd851fde47a6f0')
  expect(selections).toEqual([
    { sessionId: 'parent-session', subagentId: 'agent-a64dd851fde47a6f0', shellId: null },
  ])
})

test('opens a Shell command a Feed row names by id', () => {
  const { links, selections } = linksFor([
    {
      id: 'bash-1',
      command: 'bun test',
      label: null,
      background: true,
      state: 'running',
      startedAt: null,
      endedAt: null,
      outputPath: null,
      result: null,
    },
  ])
  links.open('bash-1')
  expect(selections).toEqual([{ sessionId: 'parent-session', subagentId: null, shellId: 'bash-1' }])
})
