import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { type CompanionPart, openCompanionPlugin } from '../drive/companion-plugin'
import { createClaudePermissionGate } from '../drive/permission-gate'

// The hook script is what Claude Code runs, so the socket it dials is the one the gate must serve.
function hookSocket(part: CompanionPart) {
  return part.hook.script.match(/nc -U "([^"]+)"/)?.[1] ?? ''
}

const LONG_ROOT = path.join('Application Support', '@argo', 'desktop', 'claude-permission-plugins')

// #1996: Node on macOS rejects a Unix socket path of 104 bytes or more with EINVAL. Bun accepts
// one, so this suite would not see the crash without measuring the path.
test('keeps the permission socket path inside the macOS limit', () => {
  const gate = createClaudePermissionGate()
  const opened = gate.open(randomUUID())

  expect(Buffer.byteLength(hookSocket(opened))).toBeLessThan(104)

  opened.close()
  gate.close()
})

test('removes its socket folder when the app closes the gate', () => {
  const gate = createClaudePermissionGate()
  const opened = gate.open(randomUUID())
  const sockets = path.dirname(hookSocket(opened))

  opened.close()
  gate.close()

  expect(existsSync(sockets)).toBe(false)
})

// #2004: Claude writes the request to the hook's stdin, and `sh` gives a background job /dev/null.
test.each([
  ['a short root', 'allow', ''],
  ['a long root', 'allow', LONG_ROOT],
  ['a long root', 'deny', LONG_ROOT],
] as const)(
  'holds the request Claude writes to the shipped hook, under %s, and answers the hook with %s',
  async (_, decision, nested) => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-permission-'))
    const gate = createClaudePermissionGate()
    const sessionId = randomUUID()
    const plugin = openCompanionPlugin(path.join(base, nested), sessionId, [gate.open(sessionId)])
    const hook = spawn('/bin/sh', [path.join(plugin.pluginRoot, 'permission-hook.sh')])
    let output = ''
    hook.stdout.setEncoding('utf8')
    hook.stdout.on('data', (chunk: string) => {
      output += chunk
    })
    const exited = new Promise((resolve) => hook.once('close', resolve))
    hook.stdin.end('{"tool_name":"Bash",\n"tool_input":{"command":"bun test"}}\n')

    let permission = gate.pending(sessionId)
    for (let wait = 0; permission === null && hook.exitCode === null && wait < 100; wait += 1) {
      await Bun.sleep(50)
      permission = gate.pending(sessionId)
    }
    expect(permission).toMatchObject({
      sessionId,
      toolName: 'Bash',
      input: { command: 'bun test' },
    })
    gate.decide(sessionId, permission?.id ?? '', decision)
    await exited

    expect(JSON.parse(output)).toEqual({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision },
    })
    plugin.close()
    gate.close()
    await rm(base, { recursive: true, force: true })
  },
)

test('holds a managed Claude permission until the selected Session answers it', async () => {
  const gate = createClaudePermissionGate()
  const sessionId = randomUUID()
  const opened = gate.open(sessionId)
  let held: () => void = () => {}
  const heldByGate = new Promise<void>((resolve) => {
    held = resolve
  })
  const reply = new Promise<string>((resolve, reject) => {
    const socket = net.createConnection(hookSocket(opened))
    socket.setEncoding('utf8')
    socket.once('connect', () =>
      socket.write('{"tool_name":"Bash","tool_input":{"command":"bun test"}}\n'),
    )
    socket.on('data', (line) => {
      if (line === '__ARGO_GATE_HELD__\n') held()
      else resolve(line)
    })
    socket.once('error', reject)
  })

  await heldByGate
  const permission = gate.pending(sessionId)
  expect(permission).toMatchObject({ sessionId, toolName: 'Bash' })
  expect(gate.decide(sessionId, permission?.id ?? '', 'allow')).toBe(true)
  expect(await reply).toContain('"permissionDecision":"allow"')
  expect(gate.pending(sessionId)).toBeNull()

  opened.close()
  gate.close()
})
