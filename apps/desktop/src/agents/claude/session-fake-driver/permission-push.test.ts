import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import net from 'node:net'

import { createClaudePermissionGate } from '../drive/permission-gate'
import { hookSocketPath } from './hook-socket'

// Dials the gate the way the shipped hook does, so the announcement under test comes from a real
// request arriving rather than from a call to the gate's own methods.
async function askPermission(socketPath: string) {
  const socket = net.createConnection(socketPath)
  await new Promise((resolve) => socket.once('connect', resolve))
  socket.write('{"tool_name":"Bash","tool_input":{"command":"bun test"}}\n')
  return socket
}

async function waitForPending(gate: ReturnType<typeof createClaudePermissionGate>, id: string) {
  for (let wait = 0; gate.pending(id) === null && wait < 100; wait += 1) await Bun.sleep(20)
  return gate.pending(id)
}

test('announces that a Session began waiting on a Permission, and that it stopped', async () => {
  const gate = createClaudePermissionGate()
  const sessionId = randomUUID()
  const opened = gate.open(sessionId)
  let announcements = 0
  const watched = gate.watchPending(() => {
    announcements += 1
  })

  const socket = await askPermission(hookSocketPath(opened))
  const permission = await waitForPending(gate, sessionId)
  const afterArrival = announcements
  gate.decide(sessionId, permission?.id ?? '', 'allow')

  expect(afterArrival).toBe(1)
  expect(announcements).toBe(2)

  watched.close()
  socket.destroy()
  opened.close()
  gate.close()
})

test('announces nothing to a listener that has closed its subscription', async () => {
  const gate = createClaudePermissionGate()
  const sessionId = randomUUID()
  const opened = gate.open(sessionId)
  let announcements = 0
  gate
    .watchPending(() => {
      announcements += 1
    })
    .close()

  const socket = await askPermission(hookSocketPath(opened))
  await waitForPending(gate, sessionId)

  expect(announcements).toBe(0)

  socket.destroy()
  opened.close()
  gate.close()
})
