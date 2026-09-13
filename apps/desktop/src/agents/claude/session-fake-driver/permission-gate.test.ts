import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'

import type { CompanionPart } from '../drive/companion-plugin'
import { createClaudePermissionGate } from '../drive/permission-gate'

// The hook script is what Claude Code runs, so the socket it dials is the one the gate must serve.
function hookSocket(part: CompanionPart) {
  return part.hook.script.match(/nc -U "([^"]+)"/)?.[1] ?? ''
}

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
