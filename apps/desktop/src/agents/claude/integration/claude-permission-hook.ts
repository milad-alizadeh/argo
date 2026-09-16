import { readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'

// The hook script Claude Code would run for this Session, so a raised Permission dials the same
// socket the real hook does — proving the driver wires the gate it owns, not a stand-in.
export function hookSocket(pluginRoot: string, sessionId: string): string {
  const script = readFileSync(path.join(pluginRoot, sessionId, 'permission-hook.sh'), 'utf8')
  return script.match(/nc -U "([^"]+)"/)?.[1] ?? ''
}

// Raises a Permission the way the shipped hook does: dial the socket, write the request, and wait
// for the gate to hold it before returning the open connection.
export async function raisePermission(pluginRoot: string, sessionId: string, request: string) {
  const socket = net.createConnection(hookSocket(pluginRoot, sessionId))
  await new Promise<void>((resolve, reject) => {
    socket.setEncoding('utf8')
    socket.once('connect', () => socket.write(request))
    socket.on('data', (line: string) => {
      if (line === '__ARGO_GATE_HELD__\n') resolve()
    })
    socket.once('error', reject)
  })
  return socket
}
