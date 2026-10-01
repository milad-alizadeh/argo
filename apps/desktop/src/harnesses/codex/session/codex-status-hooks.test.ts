import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installStatusHooks } from '@/harnesses/host/status-hooks'
import recorded from '@/mocks/cli/codex/fixtures/config-read-codex-0.157.0.json' with {
  type: 'json',
}
import { testStatusHookInstall } from '@/mocks/cli/status-hook-install-suite'
import { hookReadings } from '@/mocks/cli/status-hooks'
import type { CodexRequest } from '../app-server'
import { createCodexStatusHooks } from './codex-status-hooks'

// An app-server that answers the recorded `config/read` with its user layer's hooks as the writes
// left them, and records each `config/value/write`.
function codex(userHooks: boolean) {
  const recordedUser = recorded.layers.find((layer) => layer.name.type === 'user')
  const userConfig = recordedUser?.config as { hooks?: Record<string, unknown> } | undefined
  let hooks = userHooks ? structuredClone(userConfig?.hooks ?? {}) : {}
  let version = 0
  const writes: unknown[] = []
  const request = (async (method, params, parse) => {
    if (method === 'config/read') {
      const layers = recorded.layers.map((layer) =>
        layer === recordedUser
          ? { ...layer, version: `v${version}`, config: { ...layer.config, hooks } }
          : layer,
      )
      return parse({ ...recorded, layers })
    }
    writes.push(params)
    const { keyPath, value } = params as { keyPath: string; value: unknown }
    const { [keyPath.replace('hooks.', '')]: _old, ...rest } = hooks
    hooks = value === null ? rest : { ...hooks, [keyPath.replace('hooks.', '')]: value }
    version += 1
    return parse({ status: 'ok', version: `v${version}`, filePath: 'config.toml' })
  }) as CodexRequest
  return { hooks: createCodexStatusHooks(request), read: async () => hooks, writes }
}

testStatusHookInstall('codex', async (_context, userHooks) => {
  const { hooks, read } = codex(userHooks)
  return { hooks, read: read as () => Promise<Record<string, unknown[]>> }
})

test('a Codex install writes each event it changes through config/value/write, chaining versions', async () => {
  const { hooks, writes } = codex(true)
  await installStatusHooks('codex', hooks, 4321)
  assert.equal(writes.length, 7)
  writes.forEach((params, index) => {
    const { keyPath, mergeStrategy, expectedVersion, filePath } = params as Record<string, unknown>
    assert.match(String(keyPath), /^hooks\.[A-Za-z]+$/)
    assert.equal(mergeStrategy, 'replace')
    assert.equal(expectedVersion, `v${index}`)
    assert.equal(filePath, undefined)
  })
})

test('each Codex event of a Bash Turn sets its status, and PreToolUse its activity line', () => {
  assert.deepEqual(hookReadings('codex', codex(false).hooks, 'bashTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'running', 'Ran touch b.txt'],
    ['PermissionRequest', 'permission', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})

test('a Codex request_user_input shows asking until it is answered', () => {
  assert.deepEqual(hookReadings('codex', codex(false).hooks, 'questionTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'asking', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})
