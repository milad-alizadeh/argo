import { expect, test } from 'bun:test'
import { worktreeName } from './session-worktree'

test('reads the worktree directory from a session cwd', () => {
  expect(worktreeName('/Users/milad/Developer/argo/.claude/worktrees/ticket-2155-header')).toBe(
    'ticket-2155-header',
  )
})

test('leaves a shared checkout unnamed', () => {
  expect(worktreeName('/Users/milad/Developer/argo')).toBeNull()
})
