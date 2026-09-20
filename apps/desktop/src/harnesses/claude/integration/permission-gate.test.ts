import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { openCompanionPlugin } from '@/harnesses/claude/drive/companion-plugin'
import { createClaudePermissionGate } from '@/harnesses/claude/drive/permission-gate'
import { hookSocketPath } from '@/harnesses/claude/integration/hook-socket'

const LONG_ROOT = path.join('Application Support', '@argo', 'desktop', 'claude-permission-plugins')

// #1996: Node on macOS rejects a Unix socket path of 104 bytes or more with EINVAL. Bun accepts
// one, so this suite would not see the crash without measuring the path.
test('keeps the permission socket path inside the macOS limit', () => {
  const gate = createClaudePermissionGate()
  const opened = gate.open(randomUUID())

  expect(Buffer.byteLength(hookSocketPath(opened))).toBeLessThan(104)

  opened.close()
  gate.close()
})

test('removes its socket folder when the app closes the gate', () => {
  const gate = createClaudePermissionGate()
  const opened = gate.open(randomUUID())
  const sockets = path.dirname(hookSocketPath(opened))

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

// Dials the gate as the hook does; `held` resolves once the gate holds the request for an answer.
function askGate(part: CompanionPart, command: string) {
  let held: () => void = () => {}
  const heldByGate = new Promise<void>((resolve) => {
    held = resolve
  })
  const reply = new Promise<string>((resolve, reject) => {
    const socket = net.createConnection(hookSocketPath(part))
    socket.setEncoding('utf8')
    socket.once('connect', () =>
      socket.write(`${JSON.stringify({ tool_name: 'Bash', tool_input: { command } })}\n`),
    )
    socket.on('data', (line) => {
      if (line === '__ARGO_GATE_HELD__\n') held()
      else resolve(line)
    })
    socket.once('error', reject)
  })
  return { held: heldByGate, reply }
}

test('holds a managed Claude permission until the selected Session answers it', async () => {
  const gate = createClaudePermissionGate()
  const sessionId = randomUUID()
  const opened = gate.open(sessionId)
  const { held, reply } = askGate(opened, 'bun test')

  await held
  const permission = gate.pending(sessionId)
  expect(permission).toMatchObject({ sessionId, toolName: 'Bash' })
  expect(gate.decide(sessionId, permission?.id ?? '', 'allow')).toBe(true)
  expect(await reply).toContain('"permissionDecision":"allow"')
  expect(gate.pending(sessionId)).toBeNull()

  opened.close()
  gate.close()
})

test('answers a similar request without asking again once the Session allows similar', async () => {
  const gate = createClaudePermissionGate()
  const sessionId = randomUUID()
  const opened = gate.open(sessionId)
  const first = askGate(opened, 'bun test composer')
  await first.held
  gate.decide(sessionId, gate.pending(sessionId)?.id ?? '', 'allowSimilar')
  expect(await first.reply).toContain('"permissionDecision":"allow"')

  expect(await askGate(opened, 'bun test feed').reply).toContain('"permissionDecision":"allow"')
  const different = askGate(opened, 'rm -rf build')
  await different.held
  expect(gate.pending(sessionId)).toMatchObject({ input: { command: 'rm -rf build' } })

  opened.close()
  gate.close()
})
