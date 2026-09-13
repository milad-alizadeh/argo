import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { createClaudePermissionGate } from '../drive/permission-gate'

test('holds a managed Claude permission until the selected Session answers it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-permission-'))
  const gate = createClaudePermissionGate(root)
  const opened = gate.open('session-one')
  const hook = await readFile(path.join(opened.pluginRoot, 'permission-hook.sh'), 'utf8')
  const socketPath = /nc -U "([^"]+)"/.exec(hook)?.[1] ?? ''
  let held: () => void = () => {}
  const heldByGate = new Promise<void>((resolve) => {
    held = resolve
  })
  const reply = new Promise<string>((resolve, reject) => {
    const socket = net.createConnection(socketPath)
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
  const permission = gate.pending('session-one')
  expect(permission).toMatchObject({ sessionId: 'session-one', toolName: 'Bash' })
  expect(gate.decide('session-one', permission?.id ?? '', 'allow')).toBe(true)
  expect(await reply).toContain('"permissionDecision":"allow"')
  expect(gate.pending('session-one')).toBeNull()

  opened.close()
  gate.close()
  expect(existsSync(path.dirname(socketPath))).toBe(false)
  await rm(root, { recursive: true, force: true })
})
