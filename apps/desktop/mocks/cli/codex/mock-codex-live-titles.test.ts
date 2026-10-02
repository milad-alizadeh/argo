import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createCodexSessionSummaryList } from '@/harnesses/codex/session/codex-session-discovery'
import { mockStartInput } from './mock-codex-channel.ts'
import { writeMockCodexLive } from './mock-codex-cli.ts'
import { clientBackedByMock } from './mock-codex-driver.ts'
import { openLiveSession, waitFor } from './mock-codex-live-session.ts'

const PROMPT = 'Started in another Codex process'

// The mock lists a thread as Codex does, with `name` and `preview`, so a discovered row has a title.
test('a thread the mock started elsewhere is discovered with its first prompt (#3167)', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-live-titles-'))
  const client = clientBackedByMock(await writeMockCodexLive(root))
  const session = openLiveSession(client, { ...mockStartInput, cwd: root, prompt: PROMPT })
  try {
    await waitFor(() => session.has('turn.completed'))
    const { records } = await createCodexSessionSummaryList(client.request)({ knownNativeIds: [] })
    const [record] = records
    expect(records).toHaveLength(1)
    expect(record?.preview).toBe(PROMPT)
  } finally {
    session.channel.close()
    client.shutdown()
    await rm(root, { recursive: true, force: true })
  }
})
