import { describe, expect, it } from 'vitest'
import type { BranchRef } from '../../shared'
import { parseBranchRefs } from './branchRefs'

// Captured verbatim from this repository on git 2.50.1:
//   git for-each-ref --format='%(refname)%09%(upstream:short)%09%(upstream:track)' \
//     refs/heads refs/remotes/origin
const REFS = [
  'refs/heads/argo/#264-app-shell\t\t',
  'refs/heads/argo/#94-vocab-comment-tail\torigin/argo/#94-vocab-comment-tail\t[behind 1]',
  'refs/heads/argo/#99-roster-rename\torigin/argo/#99-roster-rename\t[gone]',
  'refs/heads/argo/delivery-card-tokenize\torigin/main\t[ahead 1, behind 54]',
  'refs/heads/main\torigin/main\t[behind 2]',
  'refs/remotes/origin/HEAD\t\t',
  'refs/remotes/origin/argo/#94-vocab-comment-tail\t\t',
  'refs/remotes/origin/argo/263-ui-inventory\t\t',
  'refs/remotes/origin/main\t\t',
  '',
].join('\n')

const named = (name: string): BranchRef | null =>
  parseBranchRefs(REFS).find((ref) => ref.name === name) ?? null

describe('the branch menu', () => {
  it('lists a local branch with how far it has drifted from its upstream', () => {
    expect(named('argo/#94-vocab-comment-tail')).toEqual({
      name: 'argo/#94-vocab-comment-tail',
      remote: false,
      ahead: 0,
      behind: 1,
      worktreePath: null,
    })
  })

  it('lists a diverged branch as both ahead and behind', () => {
    expect(named('argo/delivery-card-tokenize')).toMatchObject({ ahead: 1, behind: 54 })
  })

  it('shows no drift for a branch whose upstream was deleted', () => {
    expect(named('argo/#99-roster-rename')).toMatchObject({ ahead: 0, behind: 0 })
  })

  it('shows no drift for a branch that tracks nothing', () => {
    expect(named('argo/#264-app-shell')).toMatchObject({ remote: false, ahead: 0, behind: 0 })
  })

  it('lists an origin ref with the mirror of its local counterpart drift', () => {
    expect(named('origin/main')).toEqual({
      name: 'origin/main',
      remote: true,
      ahead: 2,
      behind: 0,
      worktreePath: null,
    })
  })

  it('shows no drift for an origin ref no local branch of that name tracks', () => {
    expect(named('origin/argo/263-ui-inventory')).toMatchObject({
      remote: true,
      ahead: 0,
      behind: 0,
    })
  })

  it('omits origin/HEAD, which names a default branch rather than one to check out', () => {
    expect(parseBranchRefs(REFS).map((ref) => ref.name)).not.toContain('origin')
  })
})
