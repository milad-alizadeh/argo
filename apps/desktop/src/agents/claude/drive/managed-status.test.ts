import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claudeManagedStatus } from '@/agents/claude/drive/managed-status'

test('Claude: a Session holding a Permission the person has not answered reads permission', () => {
  assert.equal(claudeManagedStatus(true), 'permission')
})

test('Claude: a driven Session with no Permission outstanding reads running', () => {
  assert.equal(claudeManagedStatus(false), 'running')
})
