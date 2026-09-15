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
}

const completed = {
  shape: 'delegation' as const,
  id: 'shell-end',
  actor: 'shell' as const,
  action: 'Build completed',
  status: 'completed',
  progress: null,
  groupId: 'build',
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
