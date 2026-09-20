// The port lifecycle a development launch needs: picking one from the worktree hash, validating
// an override, and proving it is free before Vite or the control server binds it.
import { createServer } from 'node:net'

export const PORT_ENV = 'ARGO_DESKTOP_DEV_PORT'
const PORT_START = 41_000
const PORT_COUNT = 20_000

export function integerPort(value: string): number {
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535)
    throw new Error(`${PORT_ENV} must be an integer between 1024 and 65535.`)
  return port
}

export function portFromHash(hash: string): number {
  return PORT_START + (Number.parseInt(hash.slice(0, 8), 16) % PORT_COUNT)
}

export function portCollisionError(port: number, identity: string): Error {
  return new Error(
    `Port ${port} for ${identity} is already in use. Stop that development run or set ${PORT_ENV} to a free port.`,
  )
}

async function assertPortAvailableOnHost(port: number, host: string, identity: string) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer()
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(portCollisionError(port, identity))
        return
      }
      // IPv6 can be disabled on a perfectly usable local development host.
      // Vite will bind its IPv4 loopback address in that case, so this is not a
      // collision and must not prevent an isolated desktop launch.
      if (host === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(error.code ?? '')) {
        resolve()
        return
      }
      reject(error)
    })
    server.listen(port, host, () => server.close(() => resolve()))
  })
}

// The profile command attaches over this port (#2228). The OS picks it, so two worktrees never collide.
export function freeLoopbackPort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

export async function assertPortAvailable(port: number, identity: string) {
  await assertPortAvailableOnHost(port, '127.0.0.1', identity)
  await assertPortAvailableOnHost(port, '::1', identity)
}
