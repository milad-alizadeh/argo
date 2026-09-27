import { expect, test } from 'bun:test'
import { sessionWorkspaceIdentity } from './session-screen-workspace'

const workspaces = [
  { id: 'main', displayName: 'Argo', facts: { branch: 'main' } },
  { id: 'worktree', displayName: 'Ticket worktree', facts: { branch: 'argo/#2758' } },
  { id: 'detached', displayName: 'Detached checkout', facts: { branch: null } },
]

test('uses the stored Workspace id and its current branch', () => {
  expect(sessionWorkspaceIdentity({ workspaceId: 'worktree' }, workspaces)).toEqual({
    displayName: 'Ticket worktree',
    branch: 'argo/#2758',
  })
})

test('keeps a linked Workspace when Git reports detached HEAD', () => {
  expect(sessionWorkspaceIdentity({ workspaceId: 'detached' }, workspaces)).toEqual({
    displayName: 'Detached checkout',
    branch: null,
  })
})

test('omits identity for a legacy Session or a Workspace missing from the current list', () => {
  expect(sessionWorkspaceIdentity({ workspaceId: null }, workspaces)).toBeNull()
  expect(sessionWorkspaceIdentity({ workspaceId: 'removed-workspace' }, workspaces)).toBeNull()
})
