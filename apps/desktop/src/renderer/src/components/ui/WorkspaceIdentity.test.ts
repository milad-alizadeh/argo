import { describe, expect, it } from 'vitest'
import { syncLabel, workspaceTag } from './WorkspaceIdentity'

describe('workspaceTag', () => {
  it('names the main tree, whatever the directory says', () => {
    expect(workspaceTag('main', 'main', '/repository')).toEqual({ kind: 'main-tree' })
  })

  it('is a named worktree when the directory leaf matches the branch leaf', () => {
    expect(workspaceTag('worktree', 'feat/auth-rotation', '/worktrees/auth-rotation')).toEqual({
      kind: 'named-worktree',
      directory: '/worktrees/auth-rotation',
    })
  })

  it('is adopted when the directory leaf diverges from the branch leaf', () => {
    expect(workspaceTag('worktree', 'feat/auth-rotation', '/worktrees/hotfix')).toEqual({
      kind: 'adopted-worktree',
      directory: '/worktrees/hotfix',
    })
  })

  it('compares leaves, so a bare branch matching the directory leaf is still named', () => {
    expect(workspaceTag('worktree', 'auth-rotation', '/some/nested/auth-rotation')).toEqual({
      kind: 'named-worktree',
      directory: '/some/nested/auth-rotation',
    })
  })

  it('ignores a trailing slash on the directory', () => {
    expect(workspaceTag('worktree', 'auth-rotation', '/worktrees/auth-rotation/')).toEqual({
      kind: 'named-worktree',
      directory: '/worktrees/auth-rotation/',
    })
  })
})

describe('syncLabel', () => {
  it('shows both arrows when ahead and behind', () => {
    expect(syncLabel(2, 1)).toBe('↑2 ↓1 vs main')
  })

  it('drops the behind arrow when only ahead', () => {
    expect(syncLabel(2, 0)).toBe('↑2 vs main')
  })

  it('drops the ahead arrow when only behind', () => {
    expect(syncLabel(0, 3)).toBe('↓3 vs main')
  })

  it('reads level with main when neither ahead nor behind', () => {
    expect(syncLabel(0, 0)).toBe('= vs main')
  })
})
