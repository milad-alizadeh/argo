import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { DEFAULT_AUTO_COMPACT_LIMIT } from '@/domains/sessions/contract/codex-compaction'
import { codexConfigPath, readAutoCompactLimit, writeAutoCompactLimit } from './config-file'

async function withHome(context: import('node:test').TestContext): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-compaction-'))
  context.after(() => rm(home, { recursive: true, force: true }))
  return home
}

test('a missing config.toml reads the sensible default', async (context) => {
  const home = await withHome(context)
  assert.equal(await readAutoCompactLimit(home), DEFAULT_AUTO_COMPACT_LIMIT)
})

test('writing to a missing config.toml creates it with only the one key', async (context) => {
  const home = await withHome(context)
  await writeAutoCompactLimit(home, 120_000)
  const text = await readFile(codexConfigPath(home), 'utf8')
  assert.equal(text, 'model_auto_compact_token_limit = 120000\n')
  assert.equal(await readAutoCompactLimit(home), 120_000)
})

test('the rest of a hand-written config.toml survives a write, key order and tables included', async (context) => {
  const home = await withHome(context)
  const before = [
    'model = "gpt-5.6-terra"',
    'approval_policy = "never"',
    '',
    '[projects."/Users/milad/Developer/argo"]',
    'trust_level = "trusted"',
    '',
  ].join('\n')
  await mkdir(path.dirname(codexConfigPath(home)), { recursive: true })
  await writeFile(codexConfigPath(home), before)

  await writeAutoCompactLimit(home, 180_000)

  const after = await readFile(codexConfigPath(home), 'utf8')
  assert.equal(
    after,
    [
      'model = "gpt-5.6-terra"',
      'approval_policy = "never"',
      'model_auto_compact_token_limit = 180000',
      '',
      '[projects."/Users/milad/Developer/argo"]',
      'trust_level = "trusted"',
      '',
    ].join('\n'),
  )
})

test('an existing threshold is replaced in place, not duplicated', async (context) => {
  const home = await withHome(context)
  await mkdir(path.dirname(codexConfigPath(home)), { recursive: true })
  await writeFile(
    codexConfigPath(home),
    ['model = "gpt-5.6-terra"', 'model_auto_compact_token_limit = 160000', ''].join('\n'),
  )

  await writeAutoCompactLimit(home, 140_000)

  const after = await readFile(codexConfigPath(home), 'utf8')
  assert.equal(
    after,
    ['model = "gpt-5.6-terra"', 'model_auto_compact_token_limit = 140000', ''].join('\n'),
  )
  assert.equal(await readAutoCompactLimit(home), 140_000)
})

test('a threshold set inside a table is left alone; the top-level default still reads through', async (context) => {
  const home = await withHome(context)
  await mkdir(path.dirname(codexConfigPath(home)), { recursive: true })
  await writeFile(
    codexConfigPath(home),
    ['[projects.foo]', 'model_auto_compact_token_limit = 999999', ''].join('\n'),
  )
  assert.equal(await readAutoCompactLimit(home), DEFAULT_AUTO_COMPACT_LIMIT)
})
