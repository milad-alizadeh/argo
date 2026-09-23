import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCodexAppServerDriveAdapter } from '@/harnesses/codex/drive/codex-app-server-drive-adapter'
import { createAdapter, mockCodexExecutable } from './mock-codex-session-adapter-support.ts'

test('sends a follow-up Turn to a Codex Session this window does not hold yet', async () => {
  const executable = await mockCodexExecutable()
  const first = createAdapter(executable)
  const started = await first.execute({
    type: 'session.start',
    harness: 'codex',
    prompt: 'Open the Codex resume proof.',
    workspace: { kind: 'main' },
  })
  assert.equal(started.kind, 'accepted')
  if (started.kind !== 'accepted') return
  const sessionId = started.projection.session.nativeId
  await first.close()
  const resumed = createAdapter(executable)
  try {
    const sent = await createCodexAppServerDriveAdapter({
      adapter: resumed,
      workspaceForCwd: async () => ({ kind: 'main' }),
    }).send({
      sessionId,
      cwd: process.cwd(),
      prompt: 'Carry on after the restart.',
      setup: null,
      attachments: [],
    })
    assert.deepEqual(sent, { ok: true })
    const projection = resumed.projections().find((item) => item.session.nativeId === sessionId)
    assert.equal(
      projection?.messages.some((message) => message.text === 'Carry on after the restart.'),
      true,
    )
  } finally {
    await resumed.close()
  }
})
