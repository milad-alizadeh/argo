// Post-start Turn tracking (marking a failed Session, and live message retention) is split into
// codex-session-driver-turns.test.ts to stay under the file's line cap.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CodexSessionDriverError,
  createCodexSessionDriver,
} from '@/harnesses/codex/drive/codex-session-driver.ts'
import { mockChannel, mockChannelFailing } from '../../../../mocks/cli/codex/mock-channel.ts'

const STARTED_AT = new Date('2026-09-13T15:17:11.000Z')

test('starts a Codex thread, sends the opening Turn and scrubs Codex credentials', async () => {
  const environments: NodeJS.ProcessEnv[] = []
  const channel = mockChannel()
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: (executable, options) => {
      assert.equal(executable, '/usr/local/bin/codex')
      environments.push(options.env)
      return channel
    },
  })

  const previous = { key: process.env.OPENAI_API_KEY, codex: process.env.CODEX_API_KEY }
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.CODEX_API_KEY = 'codex-test'
  try {
    const sessionId = await driver.start({
      attachments: [],
      cwd: '/projects/argo',
      prompt: 'Inspect the failing test.',
    })

    assert.equal(sessionId, 'thread-1')
    assert.equal('OPENAI_API_KEY' in (environments[0] ?? {}), false)
    assert.equal('CODEX_API_KEY' in (environments[0] ?? {}), false)
    assert.deepEqual(
      channel.calls.map(({ method }) => method),
      ['initialize', 'thread/start', 'turn/start'],
    )
    assert.deepEqual(
      driver
        .roster()
        .map(({ id, posture, status, updatedAt }) => ({ id, posture, status, updatedAt })),
      [
        {
          id: sessionId,
          posture: 'managed',
          status: 'running',
          updatedAt: STARTED_AT.toISOString(),
        },
      ],
    )
  } finally {
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous.key
    if (previous.codex === undefined) delete process.env.CODEX_API_KEY
    else process.env.CODEX_API_KEY = previous.codex
  }
})

test('reports Codex as unavailable rather than throwing an unrelated error', async () => {
  const driver = createCodexSessionDriver({
    findExecutable: () => null,
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => mockChannel(),
  })

  await assert.rejects(
    driver.start({ attachments: [], cwd: '/projects/argo', prompt: 'Inspect the failing test.' }),
    (error) => error instanceof CodexSessionDriverError && error.code === 'harness-unavailable',
  )
})

test('a Session whose opening Turn fails to start leaves no phantom Roster row', async () => {
  const channel = mockChannelFailing('turn/start')
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => channel,
  })

  await assert.rejects(
    driver.start({ attachments: [], cwd: '/projects/argo', prompt: 'Inspect the test.' }),
  )
  assert.deepEqual(driver.roster(), [])
})
