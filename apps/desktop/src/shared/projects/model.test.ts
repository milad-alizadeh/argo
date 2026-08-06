import { describe, expect, it } from 'vitest'
import { type ProjectView, projectForCwd, projectName } from './model'

const project = (id: string, path: string): ProjectView => ({ id, name: projectName(path), path })

describe('projectName', () => {
  it.each([
    ['/Users/dev/code/argo', 'argo'],
    ['/Users/dev/code/argo/', 'argo'],
    ['C:\\Users\\dev\\argo', 'argo'],
    ['/', '/'],
  ])('names the project after its folder (%s → %s)', (path, expected) => {
    expect(projectName(path)).toBe(expected)
  })
})

describe('projectForCwd', () => {
  const argo = project('p-argo', '/Users/dev/code/argo')
  const shop = project('p-shop', '/Users/dev/code/shop')

  it('attributes a session running at the project root', () => {
    expect(projectForCwd([argo, shop], '/Users/dev/code/argo')).toBe('p-argo')
  })

  it('attributes a session running in a worktree inside the project', () => {
    expect(projectForCwd([argo], '/Users/dev/code/argo/.claude/worktrees/ticket-9')).toBe('p-argo')
  })

  it('leaves a session outside every registered project unattributed', () => {
    expect(projectForCwd([argo, shop], '/Users/dev/code/elsewhere')).toBeNull()
  })

  it('refuses a sibling folder whose name merely starts with a project path', () => {
    expect(projectForCwd([argo], '/Users/dev/code/argo-scratch')).toBeNull()
  })

  it('attributes a nested project to the innermost one that contains the session', () => {
    const vendored = project('p-vendored', '/Users/dev/code/argo/vendor/tool')
    expect(projectForCwd([argo, vendored], '/Users/dev/code/argo/vendor/tool/src')).toBe(
      'p-vendored',
    )
  })

  it('leaves a session with no observed cwd unattributed', () => {
    expect(projectForCwd([argo], null)).toBeNull()
  })

  it('ignores a trailing separator on either side of the comparison', () => {
    expect(projectForCwd([project('p', '/Users/dev/code/argo/')], '/Users/dev/code/argo')).toBe('p')
  })
})
