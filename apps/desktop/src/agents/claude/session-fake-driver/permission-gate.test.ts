import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { createClaudePermissionGate } from '../drive/permission-gate'

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

test.each([
  ['a short root', ''],
  ['a long root', LONG_ROOT],
])(
  'holds a managed Claude permission until the selected Session answers it, under %s',
  async (_, nested) => {
    const base = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-permission-'))
    const gate = createClaudePermissionGate(path.join(base, nested))
    const sessionId = randomUUID()
    const opened = gate.open(sessionId)
    let held: () => void = () => {}
    const heldByGate = new Promise<void>((resolve) => {
      held = resolve
    })
    const reply = new Promise<string>((resolve, reject) => {
      const socket = net.createConnection(hookSocket(opened.pluginRoot))
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
    await rm(base, { recursive: true, force: true })
  },
)
