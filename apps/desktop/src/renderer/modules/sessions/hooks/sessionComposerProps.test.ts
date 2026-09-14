import { expect, test } from 'bun:test'

import { sessionComposerProps } from './sessionComposerProps'

test('offers compaction for a Codex Session, same as a Claude Session', () => {
  const onCompact = async () => true
  const props = sessionComposerProps({
    identity: { kind: 'session', sessionId: 'thread-1' },
    sessionId: 'thread-1',
    onSend: async () => true,
    onCompact,
  })

  expect(props.onCompact).toBe(onCompact)
})

test('withholds compaction from a composer with no Session selected yet', () => {
  const props = sessionComposerProps({
    identity: { kind: 'draft', projectId: null },
    sessionId: 'draft',
    onSend: async () => true,
    onCompact: async () => true,
  })

  expect(props.onCompact).toBeUndefined()
})
