import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV } from '@/mocks/cli/codex/fixtures/mock-codex-skills-config'
import { clientBackedByMock, writeMockCodex } from '@/mocks/cli/codex/mock-codex-driver'
import { DEFAULT_AUTO_COMPACT_LIMIT } from '../auto-compact-limit'
import { createCodexRegistration } from '../registration'

async function autoCompactLimit(env: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-config-'))
  const client = clientBackedByMock(await writeMockCodex(root, env))
  const limit = createCodexRegistration(client).autoCompactLimit
  assert.ok(limit)
  return {
    limit,
    async stop() {
      client.shutdown()
      await rm(root, { recursive: true, force: true })
    },
  }
}

test('a Codex config with no limit reads the default', async () => {
  const codex = await autoCompactLimit()
  try {
    assert.equal(await codex.limit.read(), DEFAULT_AUTO_COMPACT_LIMIT)
  } finally {
    await codex.stop()
  }
})

test('a chosen limit is written through Codex and reads back', async () => {
  const codex = await autoCompactLimit()
  try {
    assert.equal(await codex.limit.write(120_000), 120_000)
    assert.equal(await codex.limit.read(), 120_000)
  } finally {
    await codex.stop()
  }
})

test('a limit outside the offered range is refused before Codex is asked to write it', async () => {
  const codex = await autoCompactLimit({ [MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV]: '140000' })
  try {
    await assert.rejects(codex.limit.write(10))
    assert.equal(await codex.limit.read(), 140_000)
  } finally {
    await codex.stop()
  }
})

test('a configured limit outside the range Argo can show is refused, not shown', async () => {
  const codex = await autoCompactLimit({ [MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV]: '10' })
  try {
    await assert.rejects(codex.limit.read(), /model_auto_compact_token_limit/)
  } finally {
    await codex.stop()
  }
})
