import { expect, test } from 'bun:test'
import type { WorkspaceCockpit } from '@/domains/workspaces/renderer'
import { draftTarget } from './session-draft-target'

const main = {
  id: 'workspace-main',
  kind: 'main' as const,
  displayName: 'Main checkout',
  path: '/project',
  facts: { branch: 'main', headSha: 'abc123', dirty: false },
}
const workspace: WorkspaceCockpit = {
  workspaces: [main],
  workspace: main,
  choice: main.id,
  saveFailed: false,
}
const input = {
  identity: { kind: 'draft' as const, projectId: 'project-one' },
  harness: { harness: 'codex' as const },
  projectId: 'project-one',
}

test('starts a new worktree only for the explicit New worktree choice', () => {
  expect(
    draftTarget({ ...input, workspace: { ...workspace, workspace: null, choice: 'new' } }),
  ).toMatchObject({ workspaceId: null })
  expect(draftTarget({ ...input, workspace })).toMatchObject({ workspaceId: main.id })
  expect(
    draftTarget({ ...input, workspace: { ...workspace, workspace: null, choice: main.id } }),
  ).toBeNull()
})
