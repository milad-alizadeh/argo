import { expect, test } from 'bun:test'
import { sessionLocation } from './session-screen-location'

const worktree = { path: '/worktrees/abc', branch: 'argo/session-abc', base: 'main' }

test('a Session with no worktree names its own folder and no base', () => {
  expect(sessionLocation({ cwd: '/argo', worktree: null }, 'main')).toEqual({
    path: '/argo',
    base: null,
  })
  expect(sessionLocation({ cwd: null, worktree: null }, 'main')).toBeNull()
  expect(sessionLocation(null, 'main')).toBeNull()
})

test("a worktree names its base only when it is not the Project's default branch", () => {
  expect(sessionLocation({ cwd: worktree.path, worktree }, 'main')).toEqual({
    path: '/worktrees/abc',
    base: null,
  })
  const fromRelease = { ...worktree, base: 'release/1.4' }
  expect(sessionLocation({ cwd: worktree.path, worktree: fromRelease }, 'main')).toEqual({
    path: '/worktrees/abc',
    base: 'release/1.4',
  })
  // The default branch decides, so a main checkout on another branch changes nothing.
  expect(sessionLocation({ cwd: worktree.path, worktree: fromRelease }, 'release/1.4')?.base).toBe(
    null,
  )
  expect(sessionLocation({ cwd: worktree.path, worktree }, 'trunk')?.base).toBe('main')
  const detached = { ...worktree, base: null }
  expect(sessionLocation({ cwd: worktree.path, worktree: detached }, 'main')?.base).toBeNull()
})
