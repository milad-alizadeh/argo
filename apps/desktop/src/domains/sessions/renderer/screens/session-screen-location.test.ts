import { expect, test } from 'bun:test'
import { sessionLocation } from './session-screen-location'

const checkout = { path: '/argo', branch: 'main' }
const worktree = { path: '/worktrees/abc', branch: 'argo/session-abc', base: 'main' }

test('a Session with no worktree names its own folder and no base', () => {
  expect(sessionLocation({ cwd: '/argo', worktree: null }, checkout)).toEqual({
    path: '/argo',
    base: null,
  })
  expect(sessionLocation({ cwd: null, worktree: null }, checkout)).toBeNull()
  expect(sessionLocation(null, checkout)).toBeNull()
})

test("a worktree names its base only when it is not the main checkout's branch", () => {
  expect(sessionLocation({ cwd: worktree.path, worktree }, checkout)).toEqual({
    path: '/worktrees/abc',
    base: null,
  })
  const fromRelease = { ...worktree, base: 'release/1.4' }
  expect(sessionLocation({ cwd: worktree.path, worktree: fromRelease }, checkout)).toEqual({
    path: '/worktrees/abc',
    base: 'release/1.4',
  })
  expect(sessionLocation({ cwd: worktree.path, worktree: fromRelease }, null)?.base).toBeNull()
  const detached = { ...worktree, base: null }
  expect(sessionLocation({ cwd: worktree.path, worktree: detached }, checkout)?.base).toBeNull()
})
