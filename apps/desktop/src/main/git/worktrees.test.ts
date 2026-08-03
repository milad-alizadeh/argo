import { describe, expect, it } from 'vitest'
import { attachWorktrees, parseWorktrees } from './worktrees'

// Captured verbatim from `git worktree list --porcelain` on git 2.50.1 — this repository's own
// worktrees, plus a detached one added to see what git says when a worktree holds no branch.
const WORKTREES = `worktree /Users/milad/Developer/argo
HEAD 5e12a311fb6a407e92fda3e6010dd3a802b59214
branch refs/heads/update-skills-drifted

worktree /Users/milad/Developer/argo/.claude/worktrees/argo+263-ui-inventory
HEAD e43b7d496c2e90f0c44faf0c9a2322ec66c5a088
branch refs/heads/argo/263-ui-inventory
locked claude session argo/263-ui-inventory (pid 45750 start Mon Aug  3 08:25:21 2026)

worktree /Users/milad/Developer/argo/.claude/worktrees/detached
HEAD de8b6c5863fb8f4039f71a9bfb85cc94033f5528
detached
`

const unheld = { remote: false, ahead: 0, behind: 0, worktreePath: null }

describe('the worktrees holding a branch', () => {
  it('maps every worktree-held branch to the folder holding it', () => {
    expect(parseWorktrees(WORKTREES)).toEqual(
      new Map([
        ['update-skills-drifted', '/Users/milad/Developer/argo'],
        [
          'argo/263-ui-inventory',
          '/Users/milad/Developer/argo/.claude/worktrees/argo+263-ui-inventory',
        ],
      ]),
    )
  })

  it('holds no branch for a detached worktree', () => {
    expect([...parseWorktrees(WORKTREES).values()]).not.toContain(
      '/Users/milad/Developer/argo/.claude/worktrees/detached',
    )
  })

  it('marks a worktree-held branch with its holder, so the menu can refuse the checkout', () => {
    const refs = attachWorktrees(
      [{ ...unheld, name: 'argo/263-ui-inventory' }],
      parseWorktrees(WORKTREES),
    )
    expect(refs[0]?.worktreePath).toBe(
      '/Users/milad/Developer/argo/.claude/worktrees/argo+263-ui-inventory',
    )
  })

  it('leaves a branch no worktree holds free to check out', () => {
    const refs = attachWorktrees([{ ...unheld, name: 'main' }], parseWorktrees(WORKTREES))
    expect(refs[0]?.worktreePath).toBeNull()
  })

  it('never holds an origin ref, which no worktree can check out', () => {
    const refs = attachWorktrees(
      [{ ...unheld, name: 'origin/update-skills-drifted', remote: true }],
      parseWorktrees(WORKTREES),
    )
    expect(refs[0]?.worktreePath).toBeNull()
  })
})
