import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { type ClaudePermissionGate, createClaudePermissionGate } from '../drive/permission-gate'

// The hook script is what Claude Code runs, so the socket it dials is the one the gate must serve.
function hookSocket(pluginRoot: string) {
  const hook = readFileSync(path.join(pluginRoot, 'permission-hook.sh'), 'utf8')
  return hook.match(/nc -U "([^"]+)"/)?.[1] ?? ''
}

const LONG_ROOT = path.join('Application Support', '@argo', 'desktop', 'claude-permission-plugins')

// #1996: Node on macOS rejects a Unix socket path of 104 bytes or more with EINVAL. Bun accepts
// one, so this suite would not see the crash without measuring the path.
test('keeps the permission socket path inside the macOS limit under a long root', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-permission-'))
  const opened = createClaudePermissionGate(path.join(base, LONG_ROOT)).open(randomUUID())

  expect(Buffer.byteLength(hookSocket(opened.pluginRoot))).toBeLessThan(104)

  opened.close()
  await rm(base, { recursive: true, force: true })
})

test('removes its socket folder when the app closes the gate', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-permission-'))
  const gate = createClaudePermissionGate(base)
  const opened = gate.open(randomUUID())
  const sockets = path.dirname(hookSocket(opened.pluginRoot))

  opened.close()
  gate.close()

  expect(existsSync(sockets)).toBe(false)
  await rm(base, { recursive: true, force: true })
})

// Claude Code runs the hook with the request on stdin and reads the decision from stdout.
function runHook(pluginRoot: string, request: string) {
  const hook = spawn('/bin/sh', [path.join(pluginRoot, 'permission-hook.sh')])
  let output = ''
  hook.stdout.setEncoding('utf8')
  hook.stdout.on('data', (chunk: string) => {
    output += chunk
  })
  hook.stdin.end(request)
  return new Promise<string>((resolve) => hook.once('close', () => resolve(output)))
}

async function pendingPermission(gate: ClaudePermissionGate, sessionId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const permission = gate.pending(sessionId)
    if (permission) return permission
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return null
}

test.each([
  ['a short root', 'allow', ''],
  ['a long root', 'allow', LONG_ROOT],
  ['a long root', 'deny', LONG_ROOT],
] as const)(
  'holds a Claude hook request until the selected Session answers it, under %s, with %s',
  async (_, decision, nested) => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-permission-'))
    const gate = createClaudePermissionGate(path.join(base, nested))
    const sessionId = randomUUID()
    const opened = gate.open(sessionId)

    const reply = runHook(
      opened.pluginRoot,
      '{"tool_name":"Bash",\n"tool_input":{"command":"bun test"}}\n',
    )
    const permission = await pendingPermission(gate, sessionId)
    expect(permission).toMatchObject({
      sessionId,
      toolName: 'Bash',
      input: { command: 'bun test' },
    })
    expect(gate.decide(sessionId, permission?.id ?? '', decision)).toBe(true)
    expect(JSON.parse(await reply)).toEqual({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision },
    })
    expect(gate.pending(sessionId)).toBeNull()

    opened.close()
    gate.close()
    await rm(base, { recursive: true, force: true })
  },
)
