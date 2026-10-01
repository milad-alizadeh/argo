import { expect, test } from 'bun:test'
import type { WorktreeChoiceState } from '../composer/toolbar/use-worktree-choices'
import { draftTarget } from './session-draft-target'

const worktrees: WorktreeChoiceState = {
  worktrees: [
    { path: '/project', main: true, name: 'project', branch: 'main' },
    { path: '/feature', main: false, name: 'feature', branch: 'feature' },
  ],
  choice: 'new',
  saveFailed: false,
}
const input = {
  identity: { kind: 'draft' as const, projectId: 'project-one' },
  harness: { harness: 'codex' as const },
  projectId: 'project-one',
}

test('a new Session draft names a new worktree, the main checkout, or an offered linked worktree', () => {
  for (const choice of ['new', 'main', '/feature'])
    expect(draftTarget({ ...input, worktrees: { ...worktrees, choice } })).toMatchObject({
      worktree: choice,
    })
})

test('a new Session draft has no target until its choice is listed', () => {
  expect(draftTarget({ ...input, worktrees: { ...worktrees, choice: null } })).toBeNull()
  expect(draftTarget({ ...input, worktrees: { ...worktrees, choice: '/gone' } })).toBeNull()
  expect(draftTarget({ ...input, worktrees: { ...worktrees, choice: '/project' } })).toBeNull()
})
