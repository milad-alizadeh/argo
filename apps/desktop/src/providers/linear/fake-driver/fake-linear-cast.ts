// The one person and the two teams every Linear test and the packaged proof read.
import type { FakeLinearTeam, FakeLinearUser } from './fake-linear'

export const ADA: FakeLinearUser = {
  id: 'user-ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  workspace: 'Analytical',
}

// A team Ada can see: one Ticket with a child and a blocker, and the closed blocker itself.
export const TEAM: FakeLinearTeam = {
  id: 'team-engine',
  key: 'ENG',
  name: 'Engine',
  visibleTo: [ADA.id],
  issues: [
    {
      identifier: 'ENG-1',
      title: 'Bind the mill',
      description: 'The mill turns the cards.',
      status: 'In Progress',
      stateType: 'started',
      priority: 2,
      createdAt: '2026-09-02T10:00:00.000Z',
      labels: [{ name: 'Engine', color: '#5e6ad2' }],
      children: ['ENG-2'],
      blockedBy: ['ENG-3'],
    },
    { identifier: 'ENG-2', title: 'Cut the cards', status: 'Todo', stateType: 'unstarted' },
    { identifier: 'ENG-3', title: 'Cast the gears', status: 'Done', stateType: 'completed' },
  ],
}

// A team Ada cannot see.
export const HIDDEN: FakeLinearTeam = {
  id: 'team-hidden',
  key: 'SEC',
  name: 'Secret',
  visibleTo: [],
  issues: [],
}
