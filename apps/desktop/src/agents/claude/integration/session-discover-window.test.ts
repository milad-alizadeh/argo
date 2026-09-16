// The Claude adapter's own bounded discovery (#2239): raw transcripts rather than the named
// fixture set, since these proofs need enough Sessions to cross ROSTER_PAGE_SIZE.
import { test } from 'node:test'
import { ROSTER_PAGE_SIZE } from '@/core/sessions/discover-transcript-sessions'
import { createSessionReader } from '@/core/sessions/reader'
import { assertWindowGrowsToFarSession } from '@/core/sessions/window-proof-helpers'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { claudeRoot, writeManySessions } from './session-window-fixture'

test('a Session outside the initial window is unread on first discovery, but reachable by growing the cursor or asking for it by id', async (context) => {
  const root = await claudeRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  const farId = `s${ROSTER_PAGE_SIZE + 5}`
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])

  await assertWindowGrowsToFarSession(reader, farId)
})
