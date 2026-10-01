import { expect, test } from 'bun:test'
import { sessionBranch } from './session-screen-branch'

const worktrees = [
  { path: '/argo', branch: 'main' },
  { path: '/argo-linked', branch: 'argo/#2758' },
  { path: '/argo-detached', branch: null },
]
const owned = { path: '/worktrees/abc', branch: 'argo/session-abc', owned: true }

test('names the current branch of the listed folder the Session works in', () => {
  expect(sessionBranch({ cwd: '/argo', worktree: null }, worktrees)).toBe('main')
  expect(
    sessionBranch({ cwd: '/argo-linked', worktree: { ...owned, path: '/argo-linked', owned: false } }, worktrees),
  ).toBe('argo/#2758')
  expect(sessionBranch({ cwd: '/argo-detached', worktree: null }, worktrees)).toBeNull()
})

test('names the stored branch of the Session’s own worktree, which is never listed', () => {
  expect(sessionBranch({ cwd: owned.path, worktree: owned }, worktrees)).toBe('argo/session-abc')
})

test('names no branch for a folder outside the list', () => {
  expect(sessionBranch({ cwd: '/elsewhere', worktree: null }, worktrees)).toBeNull()
  expect(sessionBranch({ cwd: null, worktree: null }, worktrees)).toBeNull()
  expect(sessionBranch(null, worktrees)).toBeNull()
})
