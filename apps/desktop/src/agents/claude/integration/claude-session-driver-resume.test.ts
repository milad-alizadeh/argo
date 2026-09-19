import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { ClaudeSessionDriverError } from '@/agents/claude/drive/driver-error.ts'
import {
  launch,
  ledgerFile,
  OPENING,
  ownedBeforeRestart,
  PASTED,
} from '@/agents/claude/integration/claude-driver-launch.ts'
import { createOwnershipLedger } from '@/domains/sessions/main/ownership-ledger.ts'

const turn = (prompt: string) => ({ prompt, setup: OPENING })

// #2092: the next Turn is what resumes a Session Argo held before, or any Session whose
// transcript Argo can read, whichever it is.
test('the next Turn to an external Session resumes its chain in a new drive channel', async (context) => {
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'chain-root')
  const { driver, spawned, pluginRoot } = launch(file, {
    resumeTarget: async (sessionId) =>
      sessionId === 'chain-root' ? { cwd: '/projects/argo', tipId: 'chain-tip' } : null,
  })

  await driver.send('chain-root', turn('Carry on with the fix.'))

  assert.deepEqual(
    spawned.map(({ environment: _environment, ...process }) => process),
    [
      {
        command: '/usr/local/bin/claude',
        commandArguments: [
          '--resume',
          'chain-tip',
          '--model',
          'opus',
          '--effort',
          'high',
          '--permission-mode',
          'manual',
          '--plugin-dir',
          path.join(pluginRoot, 'chain-root'),
        ],
        cwd: '/projects/argo',
        writes: PASTED('Carry on with the fix.'),
      },
    ],
  )
  assert.deepEqual(
    driver.roster().map(({ id, posture }) => ({ id, posture })),
    [{ id: 'chain-root', posture: 'managed' }],
  )
})

test('two Turns sent during one resume open one channel and arrive in order', async (context) => {
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'chain-root')
  const { driver, spawned } = launch(file)

  await Promise.all([
    driver.send('chain-root', turn('First.')),
    driver.send('chain-root', turn('Second.')),
  ])

  assert.equal(spawned.length, 1)
  assert.deepEqual(spawned[0]?.writes, [...PASTED('First.'), ...PASTED('Second.')])
})

test('a resumed Session whose process exits resumes again on the next Turn', async (context) => {
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'chain-root')
  const { driver, spawned, exit } = launch(file)
  await driver.send('chain-root', turn('First.'))

  exit(0)
  assert.deepEqual(driver.roster(), [])
  await driver.send('chain-root', turn('Second.'))

  assert.equal(spawned.length, 2)
  assert.deepEqual(spawned[1]?.writes, PASTED('Second.'))
})

test('a window that closes while a resume reads its transcript starts no Claude for it', async (context) => {
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'chain-root')
  let found: (target: { cwd: string; tipId: string }) => void = () => {}
  const { driver, spawned } = launch(file, {
    resumeTarget: () =>
      new Promise((resolve) => {
        found = resolve
      }),
  })

  const sent = driver.send('chain-root', turn('Carry on.'))
  driver.close()
  found({ cwd: '/projects/argo', tipId: 'chain-tip' })

  await assert.rejects(sent)
  assert.deepEqual(spawned, [])
})

const refusals: Array<{
  claim: string
  code: ClaudeSessionDriverError['code']
  arrange: (file: string) => void
  options: Parameters<typeof launch>[1]
}> = [
  {
    claim: 'refuses a Session another Argo window drives now',
    code: 'held-elsewhere',
    arrange: (file: string) =>
      createOwnershipLedger({
        path: file,
        window: { pid: process.pid, registry: 'window-other' },
        isAlive: () => true,
      }).bind('chain-root'),
    options: {},
  },
  {
    claim: 'refuses a Session whose transcript is gone',
    code: 'missing-session',
    arrange: (file: string) => ownedBeforeRestart(file, 'chain-root'),
    options: { resumeTarget: async () => null },
  },
  {
    claim: 'reports Claude Code missing instead of resuming',
    code: 'cli-unavailable',
    arrange: (file: string) => ownedBeforeRestart(file, 'chain-root'),
    options: { findExecutable: () => null },
  },
  {
    claim: 'reports a resume that fails to launch',
    code: 'launch-failed',
    arrange: (file: string) => ownedBeforeRestart(file, 'chain-root'),
    options: { spawnFails: true },
  },
]

for (const refusal of refusals) {
  test(`${refusal.claim} and holds no channel for it`, async (context) => {
    const file = await ledgerFile(context)
    refusal.arrange(file)
    const { driver, spawned } = launch(file, refusal.options)

    await assert.rejects(
      driver.send('chain-root', turn('Carry on.')),
      (error: unknown) => error instanceof ClaudeSessionDriverError && error.code === refusal.code,
    )
    assert.deepEqual(spawned, [])
    assert.deepEqual(driver.roster(), [])
  })
}
