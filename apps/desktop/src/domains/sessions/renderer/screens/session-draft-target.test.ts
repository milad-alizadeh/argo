import { expect, test } from 'bun:test'
import { draftTarget } from './session-draft-target'

const options = { checkout: { path: '/project', branch: 'main' }, branches: ['main', 'base'] }
const input = {
  identity: { kind: 'draft' as const, projectId: 'project-one' },
  harness: { harness: 'codex' as const },
  projectId: 'project-one',
}

test('a new Session draft runs in the main checkout, or in a new worktree from its start', () => {
  expect(
    draftTarget({ ...input, worktree: { options, newWorktree: false, from: null } }),
  ).toMatchObject({ worktree: { type: 'main' } })
  const from = 'base'
  expect(draftTarget({ ...input, worktree: { options, newWorktree: true, from } })).toMatchObject({
    worktree: { type: 'new', from },
  })
})

test('a new Session draft has no target until the options load', () => {
  expect(
    draftTarget({ ...input, worktree: { options: null, newWorktree: true, from: null } }),
  ).toBeNull()
})
