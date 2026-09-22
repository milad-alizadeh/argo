import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { test } from 'node:test'

import { createClaudePermissionGate } from '@/harnesses/claude/drive/permission-gate.ts'
import { launch, ledgerFile, OPENING, settle } from './claude-driver-launch.ts'
import { raisePermission } from './claude-permission-hook.ts'

const BASH = '{"tool_name":"Bash","tool_input":{}}\n'

// #2299: the Session screen reads a Permission back only when the gate says one started or stopped
// waiting, so each of those moments must be told exactly once and nothing else may be.
async function started(context: TestContext) {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const launched = launch(await ledgerFile(context), { gate })
  const sessionId = launched.driver.start({ cwd: '/projects/argo', prompt: 'Go.', setup: OPENING })
  await settle()
  const told: (string | null)[] = []
  const stop = launched.driver.onPermissionsChanged(() =>
    told.push(launched.driver.pendingPermission(sessionId)?.toolName ?? null),
  )
  return { ...launched, sessionId, stop, told }
}

test('a reader is told when a Permission starts waiting and when a decision clears it', async (context) => {
  const { driver, pluginRoot, sessionId, told } = await started(context)

  const socket = await raisePermission(pluginRoot, sessionId, BASH)
  assert.deepEqual(told, ['Bash'])

  const permissionId = driver.pendingPermission(sessionId)?.id ?? ''
  assert.equal(driver.decidePermission(sessionId, permissionId, 'deny'), true)
  assert.deepEqual(told, ['Bash', null])

  socket.end()
})

test('a stale decision tells a reader nothing', async (context) => {
  const { driver, pluginRoot, sessionId, told } = await started(context)
  const socket = await raisePermission(pluginRoot, sessionId, BASH)

  assert.equal(driver.decidePermission(sessionId, 'a-stale-permission-id', 'allow'), false)
  assert.deepEqual(told, ['Bash'])

  socket.end()
})

test('a Session that ends while a Permission waits tells a reader it cleared', async (context) => {
  const { exit, pluginRoot, sessionId, told } = await started(context)
  const socket = await raisePermission(pluginRoot, sessionId, BASH)

  exit(0)
  assert.deepEqual(told, ['Bash', null])

  socket.end()
})

test('a reader that stopped listening is told nothing', async (context) => {
  const { pluginRoot, sessionId, stop, told } = await started(context)
  stop()

  const socket = await raisePermission(pluginRoot, sessionId, BASH)
  assert.deepEqual(told, [])

  socket.end()
})
