import { expect, test } from 'bun:test'
import { sessionBranch } from './session-screen-branch'

const checkout = { path: '/argo', branch: 'main' }
const worktree = { path: '/worktrees/abc', branch: 'argo/session-abc' }

test("names the main checkout's current branch for a Session working there", () => {
  expect(sessionBranch({ cwd: '/argo', worktree: null }, checkout)).toBe('main')
  expect(sessionBranch({ cwd: '/argo', worktree: null }, { ...checkout, branch: null })).toBeNull()
})

test("names the stored branch of the Session's own worktree", () => {
  expect(sessionBranch({ cwd: worktree.path, worktree }, checkout)).toBe('argo/session-abc')
})

test('names no branch for any other folder, or before the checkout loads', () => {
  expect(sessionBranch({ cwd: '/imported-worktree', worktree: null }, checkout)).toBeNull()
  expect(sessionBranch({ cwd: '/argo', worktree: null }, null)).toBeNull()
  expect(sessionBranch({ cwd: null, worktree: null }, checkout)).toBeNull()
  expect(sessionBranch(null, checkout)).toBeNull()
})
