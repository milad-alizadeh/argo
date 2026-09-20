// The Claude adapter's own bounded discovery (#2239): raw transcripts rather than the named
// fixture set, since these proofs need enough Sessions to cross ROSTER_PAGE_SIZE.
import { test } from 'node:test'
import { ROSTER_PAGE_SIZE } from '@/domains/sessions/main/observation/discover-transcript-sessions'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { assertWindowGrowsToFarSession } from '@/domains/sessions/main/observation/window-proof-helpers'
import {
  claudeRoot,
  writeManySessions,
} from '@/harnesses/claude/integration/session-window-fixture'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions.ts'

test('a Session outside the initial window is unread on first discovery, but reachable by growing the cursor or asking for it by id', async (context) => {
  const root = await claudeRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  const farId = `s${ROSTER_PAGE_SIZE + 5}`
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])

  await assertWindowGrowsToFarSession(reader, farId)
})
