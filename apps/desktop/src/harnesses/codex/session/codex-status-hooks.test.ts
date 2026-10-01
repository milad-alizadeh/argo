import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { installStatusHooks } from '@/harnesses/host/status-hooks'
import {
  createMockCodexSkillsAndConfig,
  MOCK_CODEX_USER_HOOKS_FILE,
} from '@/mocks/cli/codex/fixtures/mock-codex-skills-config'
import { recordedCall } from '@/mocks/cli/codex/recorded-codex-threads'
import { testStatusHookInstall } from '@/mocks/cli/status-hook-install-suite'
import { hookReadings } from '@/mocks/cli/status-hooks'
import type { CodexRequest } from '../app-server'
import { createCodexStatusHooks } from './codex-status-hooks'

// The mock app-server over a fresh CODEX_HOME, seeded with the recorded user hooks or with none.
function codex(context: TestContext, userHooks: boolean) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-hooks-'))
  context.after(() => rmSync(home, { recursive: true, force: true }))
  const file = path.join(home, MOCK_CODEX_USER_HOOKS_FILE)
  const user = recordedCall('config/read').result.layers.find(
    (layer) => layer.name.type === 'user',
  )?.config
  if (userHooks) writeFileSync(file, JSON.stringify((user as { hooks?: unknown }).hooks))
  const writes: { params: unknown; version: unknown }[] = []
  let answer: Record<string, unknown> = {}
  const answerConfig = createMockCodexSkillsAndConfig((message) => (answer = message), home)
  const request = (async (method, params, parse) => {
    answerConfig({ id: 1, method, params: params as Record<string, unknown> })
    const result = answer.result as { version?: unknown }
    if (method === 'config/value/write') writes.push({ params, version: result.version })
    return parse(result)
  }) as CodexRequest
  const read = async () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})
  return { hooks: createCodexStatusHooks(request), read, writes }
}

testStatusHookInstall('codex', async (context, userHooks) => codex(context, userHooks))

test('a Codex install writes each event it changes through config/value/write, chaining versions', async (context) => {
  const { hooks, writes } = codex(context, true)
  await installStatusHooks('codex', hooks, 4321)
  assert.equal(writes.length, 7)
  writes.forEach(({ params }, index) => {
    const { keyPath, mergeStrategy, expectedVersion, filePath } = params as Record<string, unknown>
    assert.match(String(keyPath), /^hooks\.[A-Za-z]+$/)
    assert.equal(mergeStrategy, 'replace')
    if (index > 0) assert.equal(expectedVersion, writes[index - 1]?.version)
    assert.equal(filePath, undefined)
  })
})

test('each Codex event of a Bash Turn sets its status, and PreToolUse its activity line', (context) => {
  assert.deepEqual(hookReadings('codex', codex(context, false).hooks, 'bashTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'running', 'Ran touch b.txt'],
    ['PermissionRequest', 'permission', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})

test('a Codex request_user_input shows asking until it is answered', (context) => {
  assert.deepEqual(hookReadings('codex', codex(context, false).hooks, 'questionTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'asking', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})
