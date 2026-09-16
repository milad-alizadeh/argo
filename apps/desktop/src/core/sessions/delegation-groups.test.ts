import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupDelegations } from './delegation-groups'
import { sessionFeedRowSchema } from './feed-rows'

const started = {
  shape: 'delegation' as const,
  id: 'shell-start',
  actor: 'shell' as const,
  action: 'Build started',
  status: 'running',
  progress: null,
  groupId: 'build',
  callId: null,
}

const completed = {
  shape: 'delegation' as const,
  id: 'shell-end',
  actor: 'shell' as const,
  action: 'Build completed',
  status: 'completed',
  progress: null,
  groupId: 'build',
  callId: null,
}

test('groups adjacent Shell updates for one background task', () => {
  const rows = groupDelegations([started, completed])
  assert.deepEqual(rows, [
    {
      shape: 'delegation-group',
      id: 'shell-start',
      actor: 'shell',
      groupId: 'build',
      entries: [started, completed],
    },
  ])
})

test('groups adjacent Agent updates for one subagent', () => {
  const agentStarted = { ...started, actor: 'agent' as const, groupId: 'agent-1' }
  const agentCompleted = { ...completed, actor: 'agent' as const, groupId: 'agent-1' }
  const rows = groupDelegations([agentStarted, agentCompleted])
  assert.deepEqual(rows, [
    {
      shape: 'delegation-group',
      id: 'shell-start',
      actor: 'agent',
      groupId: 'agent-1',
      entries: [agentStarted, agentCompleted],
    },
  ])
})

test('groups one Agent lifecycle across visible parent rows', () => {
  const agentStarted = { ...started, actor: 'agent' as const, groupId: 'agent-1' }
  const agentCompleted = { ...completed, actor: 'agent' as const, groupId: 'agent-1' }
  const parentReply = {
    shape: 'prose' as const,
    id: 'parent-reply',
    role: 'assistant' as const,
    text: 'The delegated review is still running.',
  }
  const rows = groupDelegations([agentStarted, parentReply, agentCompleted])
  assert.deepEqual(rows, [
    {
      shape: 'delegation-group',
      id: 'shell-start',
      actor: 'agent',
      groupId: 'agent-1',
      entries: [agentStarted, agentCompleted],
    },
    parentReply,
  ])
})

test('keeps a maximum-length Shell group valid at the Feed boundary', () => {
  const groupId = 'g'.repeat(256)
  const [row] = groupDelegations([{ ...started, groupId }])
  assert.deepEqual(sessionFeedRowSchema.parse(row), {
    shape: 'delegation-group',
    id: started.id,
    actor: 'shell',
    groupId,
    entries: [{ ...started, groupId }],
  })
})

test('rejects an Agent entry inside a Shell activity group', () => {
  const parsed = sessionFeedRowSchema.safeParse({
    shape: 'delegation-group',
    id: 'mixed',
    actor: 'shell',
    groupId: 'build',
    entries: [{ ...started, actor: 'agent' }],
  })
  assert.equal(parsed.success, false)
})

test('rejects a Shell activity entry with a different or missing group id', () => {
  for (const groupId of ['other', null]) {
    const parsed = sessionFeedRowSchema.safeParse({
      shape: 'delegation-group',
      id: 'mismatched',
      actor: 'shell',
      groupId: 'build',
      entries: [{ ...started, groupId }],
    })
    assert.equal(parsed.success, false)
  }
})
