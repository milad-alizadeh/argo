import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createFakeIpcWindow, RENDERER_URL } from '@/core/contract/test-support'
import { attachCodexCompactionBridge } from './bridge'
import { CODEX_COMPACTION_OPERATIONS, DEFAULT_AUTO_COMPACT_LIMIT } from './compaction'
import { codexConfigPath } from './config-file'

async function withHome(context: import('node:test').TestContext): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-compaction-bridge-'))
  context.after(() => rm(home, { recursive: true, force: true }))
  return home
}

test('an untrusted set is refused, and a later trusted get shows the default', async (context) => {
  const home = await withHome(context)
  const fake = createFakeIpcWindow()
  attachCodexCompactionBridge(fake.window, { home, rendererURL: RENDERER_URL })

  const denied = (await fake.untrustedInvoke(CODEX_COMPACTION_OPERATIONS.set.channel, {
    version: 1,
    type: 'codex-compaction.set',
    requestId: 'r1',
    limit: 100_000,
  })) as { type: string; code: string }
  assert.equal(denied.type, 'codex-compaction.error')
  assert.equal(denied.code, 'access-denied')

  const after = (await fake.trustedInvoke(CODEX_COMPACTION_OPERATIONS.get.channel, {
    version: 1,
    type: 'codex-compaction.get',
    requestId: 'r2',
  })) as { limit: number }
  assert.equal(after.limit, DEFAULT_AUTO_COMPACT_LIMIT)
})

test('a trusted set writes ~/.codex/config.toml and a later get reads it back', async (context) => {
  const home = await withHome(context)
  const fake = createFakeIpcWindow()
  attachCodexCompactionBridge(fake.window, { home, rendererURL: RENDERER_URL })

  const set = (await fake.trustedInvoke(CODEX_COMPACTION_OPERATIONS.set.channel, {
    version: 1,
    type: 'codex-compaction.set',
    requestId: 'r1',
    limit: 145_000,
  })) as { limit: number }
  assert.equal(set.limit, 145_000)

  const text = await readFile(codexConfigPath(home), 'utf8')
  assert.equal(text, 'model_auto_compact_token_limit = 145000\n')

  const after = (await fake.trustedInvoke(CODEX_COMPACTION_OPERATIONS.get.channel, {
    version: 1,
    type: 'codex-compaction.get',
    requestId: 'r2',
  })) as { limit: number }
  assert.equal(after.limit, 145_000)
})

test('a limit outside the composer range is refused as an invalid request', async (context) => {
  const home = await withHome(context)
  const fake = createFakeIpcWindow()
  attachCodexCompactionBridge(fake.window, { home, rendererURL: RENDERER_URL })

  const refused = (await fake.trustedInvoke(CODEX_COMPACTION_OPERATIONS.set.channel, {
    version: 1,
    type: 'codex-compaction.set',
    requestId: 'r1',
    limit: 1,
  })) as { type: string; code: string }
  assert.equal(refused.type, 'codex-compaction.error')
  assert.equal(refused.code, 'invalid-request')
})
