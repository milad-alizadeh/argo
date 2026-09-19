import net from 'node:net'
import { type CompanionPart, createSocketFolder } from '@/agents/claude/drive/companion-plugin'

// Claude Code holds each batch on screen until this returns, so it only hands the input over.
// With no Argo listening `nc` fails at once, `-w 1` bounds a listener that never reads, and it
// prints nothing, so the terminal draws the original text.
const HOOK = `#!/bin/sh
/usr/bin/nc -U -w 1 "__ARGO_DISPLAY_SOCKET__" >/dev/null 2>&1
exit 0
`

// The MessageDisplay hook of each managed Session, and the socket it hands its batches to.
export function createMessageDisplay() {
  const sockets = createSocketFolder('display')
  return {
    open(sessionId: string, record: (batch: unknown) => void): CompanionPart {
      const socketPath = sockets.socketPath(sessionId)
      const server = net.createServer((socket) => {
        let received = ''
        socket.setEncoding('utf8')
        socket.on('data', (chunk) => {
          received += chunk
        })
        socket.on('end', () => {
          socket.end()
          try {
            record(JSON.parse(received) as unknown)
          } catch {
            // A batch that is not JSON costs the draft only; the transcript still records it.
          }
        })
      })
      server.on('error', (error) =>
        console.error('Claude message display stopped listening', error),
      )
      server.listen(socketPath)
      return {
        hook: {
          event: 'MessageDisplay',
          file: 'display-hook.sh',
          script: HOOK.replace('__ARGO_DISPLAY_SOCKET__', socketPath),
        },
        close: () => server.close(),
      }
    },
    close: sockets.close,
  }
}

export type MessageDisplay = ReturnType<typeof createMessageDisplay>
