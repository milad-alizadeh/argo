import { describe, expect, it } from 'vitest'
import { syncLabel, workspaceTag } from './WorkspaceIdentity'

describe('workspaceTag', () => {
  it('names the main tree, whatever the dir says', () => {
    expect(workspaceTag('main', 'main', '/repo')).toEqual({ kind: 'main-tree' })
  })

  it('is a named worktree when the dir leaf matches the branch leaf', () => {
    expect(workspaceTag('worktree', 'feat/auth-rotation', '/wt/auth-rotation')).toEqual({
      kind: 'named-worktree',
      dir: '/wt/auth-rotation',
    })
  })

  it('is adopted when the dir leaf diverges from the branch leaf', () => {
    expect(workspaceTag('worktree', 'feat/auth-rotation', '/wt/hotfix')).toEqual({
      kind: 'adopted-worktree',
      dir: '/wt/hotfix',
    })
  })

  it('compares leaves, so a bare branch matching the dir leaf is still named', () => {
    expect(workspaceTag('worktree', 'auth-rotation', '/some/nested/auth-rotation')).toEqual({
      kind: 'named-worktree',
      dir: '/some/nested/auth-rotation',
    })
  })

  it('ignores a trailing slash on the dir', () => {
    expect(workspaceTag('worktree', 'auth-rotation', '/wt/auth-rotation/')).toEqual({
      kind: 'named-worktree',
      dir: '/wt/auth-rotation/',
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
