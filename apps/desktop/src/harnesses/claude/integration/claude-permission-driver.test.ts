import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { createClaudePermissionGate } from '@/harnesses/claude/drive/permission/permission-gate'
import {
  launch,
  ledgerFile,
  OPENING,
  ownedBeforeRestart,
  settle,
} from '@/harnesses/claude/integration/claude-driver-launch.ts'
import {
  hookSocket,
  raisePermission,
} from '@/harnesses/claude/integration/claude-permission-hook.ts'

test('a started Session with a pending Permission reads `permission` in the Roster and reports it', async (context) => {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const { driver, pluginRoot } = launch(await ledgerFile(context), { gate })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()

  const socket = await raisePermission(
    pluginRoot,
    sessionId,
    '{"tool_name":"Bash","tool_input":{"command":"bun test"}}\n',
  )

  assert.deepEqual(
    driver.roster().map(({ id, status }) => ({ id, status })),
    [{ id: sessionId, status: 'permission' }],
  )
  const permission = driver.pendingPermission(sessionId)
  assert.equal(permission?.sessionId, sessionId)
  assert.equal(permission?.toolName, 'Bash')
  assert.deepEqual(permission?.input, { command: 'bun test' })

  socket.end()
})

test('an allow reaches the waiting hook and clears the `permission` status', async (context) => {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const { driver, pluginRoot } = launch(await ledgerFile(context), { gate })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  const socket = await raisePermission(
    pluginRoot,
    sessionId,
    '{"tool_name":"Bash","tool_input":{}}\n',
  )
  const reply = new Promise<string>((resolve) => socket.once('data', resolve))
  const permission = driver.pendingPermission(sessionId)

  assert.equal(driver.decidePermission(sessionId, permission?.id ?? '', 'allow'), true)

  assert.equal(
    await reply,
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
    }),
  )
  assert.equal(driver.pendingPermission(sessionId), null)
  assert.deepEqual(
    driver.roster().map(({ status }) => status),
    ['running'],
  )
})

test('a deny reaches the waiting hook and clears the `permission` status', async (context) => {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const { driver, pluginRoot } = launch(await ledgerFile(context), { gate })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  const socket = await raisePermission(
    pluginRoot,
    sessionId,
    '{"tool_name":"Bash","tool_input":{}}\n',
  )
  const reply = new Promise<string>((resolve) => socket.once('data', resolve))
  const permission = driver.pendingPermission(sessionId)

  assert.equal(driver.decidePermission(sessionId, permission?.id ?? '', 'deny'), true)

  assert.equal(
    await reply,
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny' },
    }),
  )
  assert.equal(driver.pendingPermission(sessionId), null)
})

test('a decision for another Permission id is refused', async (context) => {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const { driver, pluginRoot } = launch(await ledgerFile(context), { gate })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  const socket = await raisePermission(
    pluginRoot,
    sessionId,
    '{"tool_name":"Bash","tool_input":{}}\n',
  )

  assert.equal(driver.decidePermission(sessionId, 'a-stale-permission-id', 'allow'), false)
  assert.notEqual(driver.pendingPermission(sessionId), null)

  socket.end()
})

test('a resumed Session gets its own gate', async (context) => {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'chain-root')
  const { driver, pluginRoot } = launch(file, {
    gate,
    resumeTarget: async () => ({ cwd: '/projects/argo', tipId: 'chain-tip' }),
  })

  await driver.send('chain-root', { prompt: 'Carry on.', setup: OPENING })
  const socket = await raisePermission(
    pluginRoot,
    'chain-root',
    '{"tool_name":"Bash","tool_input":{}}\n',
  )

  assert.equal(driver.pendingPermission('chain-root')?.sessionId, 'chain-root')

  socket.end()
})

test('a closed Session leaves no plugin folder for it', async (context) => {
  const gate = createClaudePermissionGate()
  context.after(() => gate.close())
  const { driver, pluginRoot, exit } = launch(await ledgerFile(context), { gate })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  const pluginDir = path.join(pluginRoot, sessionId)
  assert.equal(existsSync(pluginDir), true)

  exit(0)

  assert.equal(existsSync(pluginDir), false)
})

test('a closed driver leaves no socket folder', async (context) => {
  const gate = createClaudePermissionGate()
  const { driver, pluginRoot } = launch(await ledgerFile(context), { gate })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  const pluginDir = path.join(pluginRoot, sessionId)
  const socketFolder = path.dirname(hookSocket(pluginRoot, sessionId))
  assert.equal(existsSync(pluginDir), true)
  assert.equal(existsSync(socketFolder), true)

  driver.close()

  assert.equal(existsSync(pluginDir), false)
  assert.equal(existsSync(socketFolder), false)
})
