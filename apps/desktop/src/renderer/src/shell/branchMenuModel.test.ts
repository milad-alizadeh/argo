import { type BranchRef, type GitFacts, type SessionView, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { branchMenuRows, isDeletable, liveWorktreeSessions, manageMenu } from './branchMenuModel'

function session(id: string, cwd: string | null): SessionView {
  return {
    id,
    title: id,
    cli: 'claude',
    cwd,
    projectId: 'p1',
    posture: 'external',
    agents: [],
    facts: sessionFacts(),
  }
}

function ref(name: string, over: Partial<BranchRef> = {}): BranchRef {
  return { name, remote: false, ahead: 0, behind: 0, worktreePath: null, ...over }
}

function facts(over: Partial<GitFacts> = {}): GitFacts {
  return { branch: 'main', ahead: 0, behind: 0, branches: [ref('main')], ...over }
}

describe('the branch menu', () => {
  it('marks the checked-out branch as the one the files follow', () => {
    expect(branchMenuRows(facts(), new Map())[0]?.action).toEqual({ kind: 'current' })
  })

  it('offers a plain local branch for checkout', () => {
    const rows = branchMenuRows(facts({ branches: [ref('main'), ref('fix/ci-flake')] }), new Map())
    expect(rows[1]?.action).toEqual({ kind: 'checkout' })
  })

  it('offers an origin ref for checkout', () => {
    const rows = branchMenuRows(
      facts({ branches: [ref('origin/hotfix', { remote: true })] }),
      new Map(),
    )
    expect(rows[0]?.action).toEqual({ kind: 'checkout' })
  })

  it('refuses checkout of a branch a worktree already holds', () => {
    const held = ref('feat/tokens', { worktreePath: '/code/argo/.worktrees/tokens' })
    const rows = branchMenuRows(facts({ branches: [held] }), new Map())
    expect(rows[0]?.action.kind).not.toBe('checkout')
  })

  it('links a worktree-held branch to the live session working in it', () => {
    const held = ref('feat/tokens', { worktreePath: '/code/argo/.worktrees/tokens' })
    const live = new Map([['/code/argo/.worktrees/tokens', 'session-7']])
    expect(branchMenuRows(facts({ branches: [held] }), live)[0]?.action).toEqual({
      kind: 'worktree-session',
      sessionId: 'session-7',
    })
  })

  it('shows the path instead of a dead link once the worktree outlives its session', () => {
    const held = ref('feat/tokens', { worktreePath: '/code/argo/.worktrees/tokens' })
    expect(branchMenuRows(facts({ branches: [held] }), new Map())[0]?.action).toEqual({
      kind: 'worktree-orphaned',
      path: '/code/argo/.worktrees/tokens',
    })
  })

  it('carries each ref’s own ahead and behind counts', () => {
    const rows = branchMenuRows(
      facts({ branches: [ref('main', { ahead: 2, behind: 1 })] }),
      new Map(),
    )
    expect(rows[0]).toMatchObject({ ahead: 2, behind: 1 })
  })
})

describe('which branches a row may delete', () => {
  const rowFor = (over: Partial<BranchRef>) =>
    branchMenuRows(facts({ branches: [ref('feat/x', over)] }), new Map())[0]

  it('offers to delete a local branch nobody is standing on', () => {
    const row = rowFor({})
    expect(row && isDeletable(row)).toBe(true)
  })

  it('never offers to delete the checked-out branch', () => {
    const row = branchMenuRows(facts(), new Map())[0]
    expect(row && isDeletable(row)).toBe(false)
  })

  it('never offers to delete a branch a worktree holds', () => {
    const row = rowFor({ worktreePath: '/code/argo/.worktrees/x' })
    expect(row && isDeletable(row)).toBe(false)
  })

  it('never offers to delete a remote ref, which would lose work that is not yours', () => {
    const row = rowFor({ remote: true })
    expect(row && isDeletable(row)).toBe(false)
  })
})

describe('which worktree a session is working in', () => {
  const held = ref('feat/tokens', { worktreePath: '/code/argo/.worktrees/tokens' })

  it('maps a worktree to the session running inside it', () => {
    const sessions = [session('s1', '/code/argo/.worktrees/tokens/apps/desktop')]
    expect(
      liveWorktreeSessions(facts({ branches: [held] }), sessions).get(held.worktreePath ?? ''),
    ).toBe('s1')
  })

  it('maps nothing for a worktree the roster has no session for', () => {
    const sessions = [session('s1', '/code/argo')]
    expect(liveWorktreeSessions(facts({ branches: [held] }), sessions).size).toBe(0)
  })

  it('ignores a session whose working folder was never observed', () => {
    expect(liveWorktreeSessions(facts({ branches: [held] }), [session('s1', null)]).size).toBe(0)
  })
})

describe('the manage menu', () => {
  it('always offers a fetch, which cannot lose work', () => {
    expect(manageMenu(facts()).sync).toContain('fetch')
  })

  it('offers no pull when there is nothing to fast-forward', () => {
    expect(manageMenu(facts()).sync).not.toContain('pull')
  })

  it('offers a pull when the branch is only behind', () => {
    expect(manageMenu(facts({ behind: 1 })).sync).toContain('pull')
  })

  it('offers no pull when the branch has diverged, because it would not fast-forward', () => {
    expect(manageMenu(facts({ ahead: 2, behind: 1 })).sync).not.toContain('pull')
  })

  it('offers a push when the branch is only ahead', () => {
    expect(manageMenu(facts({ ahead: 2 })).sync).toContain('push')
  })

  it('offers no push when the branch has diverged, because the remote would reject it', () => {
    expect(manageMenu(facts({ ahead: 2, behind: 1 })).sync).not.toContain('push')
  })

  it('offers branch creation and rename whatever the branch is tracking', () => {
    expect(manageMenu(facts({ ahead: 2, behind: 1 })).branch).toEqual(['new-branch', 'rename'])
  })

  it('offers a fetch even on a diverged branch, because fetching cannot lose work either', () => {
    expect(manageMenu(facts({ ahead: 2, behind: 1 })).sync).toEqual(['fetch'])
  })

  it('never offers to delete the branch the files follow, which git would refuse', () => {
    expect(manageMenu(facts()).branch).not.toContain('delete')
  })

  it('hands a diverged branch the escape hatch instead of a merge', () => {
    expect(manageMenu(facts({ ahead: 2, behind: 1 })).diverged).toBe(true)
  })

  it('shows no escape hatch while the branch can still sync safely', () => {
    expect(manageMenu(facts({ behind: 1 })).diverged).toBe(false)
  })
})
