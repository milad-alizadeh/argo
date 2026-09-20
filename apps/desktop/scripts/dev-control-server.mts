import { createServer, type Server } from 'node:net'

function commandParts(command: Buffer): (string | undefined)[] {
  return command.toString().trim().split(' ')
}

function registeredElectron({
  processId,
  token,
  controlToken,
  registeredProcessId,
}: {
  processId: string | undefined
  token: string | undefined
  controlToken: string
  registeredProcessId: number | null
}): boolean {
  return (
    /^\d+$/.test(processId ?? '') &&
    token === controlToken &&
    Number(processId) === registeredProcessId
  )
}

/**
 * Holds the Electron PID in launcher memory after Electron proves possession of
 * an ephemeral token. A ready file is useful for discovery, but is never alone
 * sufficient authority to send a signal to a process ID.
 */
export function startControlServer(
  controlFile: string,
  controlToken: string,
  stop: (processId: number) => Promise<void>,
): Promise<Server> {
  let electronProcessId: number | null = null
  const server = createServer((socket) => {
    socket.once('data', async (command) => {
      const [verb, processId, token] = commandParts(command)
      if (verb === 'ready' && token === controlToken && /^\d+$/.test(processId ?? '')) {
        electronProcessId = Number(processId)
        socket.end('ready')
        return
      }

      if (
        verb !== 'stop' ||
        !registeredElectron({
          processId,
          token,
          controlToken,
          registeredProcessId: electronProcessId,
        })
      ) {
        socket.end('invalid command')
        return
      }

      try {
        await stop(Number(processId))
        socket.end('stopped')
      } catch {
        socket.end('failed')
      }
    })
  })
  return new Promise<Server>((resolve, reject) => {
    server.once('error', reject)
    server.listen(controlFile, () => resolve(server))
  })
}
