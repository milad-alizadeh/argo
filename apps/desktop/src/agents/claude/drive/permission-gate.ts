import net from 'node:net'
import { z } from 'zod'
import type { ClaudePermission } from '@/core/sessions/contract'
import { type CompanionPart, createSocketFolder } from './companion-plugin'

export type ClaudePermissionGate = {
  open: (sessionId: string) => CompanionPart
  pending: (sessionId: string) => ClaudePermission | null
  decide: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  close: () => void
}

const HOOK = `#!/bin/sh
deny() { printf '%s\\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}'; }
hold=$(mktemp -d) || { deny; exit 1; }
trap 'kill "$writer" "$dialler" 2>/dev/null; rm -rf "$hold"' EXIT
mkfifo "$hold/request" || { deny; exit 1; }
# A background list in a non-interactive sh reads /dev/null, so the request is kept on fd 3.
exec 3<&0
{
  tr '\\n' ' ' <&3
  printf '\\n'
  while kill -0 $$ 2>/dev/null; do sleep 1; done
} > "$hold/request" &
writer=$!
/usr/bin/nc -U "__ARGO_PERMISSION_SOCKET__" < "$hold/request" > "$hold/reply" &
dialler=$!
while [ ! -s "$hold/reply" ] && kill -0 "$dialler" 2>/dev/null; do sleep 0.1; done
first=$(sed -n '1p' "$hold/reply")
if [ "$first" = "__ARGO_GATE_HELD__" ]; then
  while [ "$(wc -l < "$hold/reply")" -lt 2 ] && kill -0 "$dialler" 2>/dev/null; do sleep 0.1; done
  first=$(sed -n '2p' "$hold/reply")
fi
[ -n "$first" ] && printf '%s\\n' "$first" || deny
`

function decisionLine(decision: 'allow' | 'deny') {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision },
  })
}

const permissionPayloadSchema = z
  .object({
    tool_name: z.string().min(1),
    tool_input: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

function requestFrom(line: string, sessionId: string): ClaudePermission | null {
  const parsed = permissionPayloadSchema.safeParse(JSON.parse(line) as unknown)
  if (!parsed.success) return null
  return {
    id: crypto.randomUUID(),
    sessionId,
    toolName: parsed.data.tool_name,
    input: parsed.data.tool_input ?? {},
  }
}

// Each managed Session gets its own Unix socket, so a late answer cannot reach a different turn.
export function createClaudePermissionGate(): ClaudePermissionGate {
  const waiting = new Map<string, { permission: ClaudePermission; socket: net.Socket }>()
  const sockets = createSocketFolder('permission')
  return {
    open: (sessionId) => openPermissionGate(sockets.socketPath(sessionId), sessionId, waiting),
    pending(sessionId) {
      return waiting.get(sessionId)?.permission ?? null
    },
    decide(sessionId, permissionId, decision) {
      const held = waiting.get(sessionId)
      if (!held || held.permission.id !== permissionId) return false
      waiting.delete(sessionId)
      held.socket.end(decisionLine(decision))
      return true
    },
    close: sockets.close,
  }
}

function openPermissionGate(
  socketPath: string,
  sessionId: string,
  waiting: Map<string, { permission: ClaudePermission; socket: net.Socket }>,
): CompanionPart {
  const server = net.createServer((socket) => {
    let received = ''
    socket.setEncoding('utf8')
    socket.on('data', (chunk) => {
      received += chunk
      const newline = received.indexOf('\n')
      if (newline < 0) return
      socket.removeAllListeners('data')
      let permission: ClaudePermission | null = null
      try {
        permission = requestFrom(received.slice(0, newline), sessionId)
      } catch {
        permission = null
      }
      if (permission === null || waiting.has(sessionId)) {
        socket.end(decisionLine('deny'))
        return
      }
      waiting.set(sessionId, { permission, socket })
      socket.write('__ARGO_GATE_HELD__\n')
    })
  })
  // Without a listener a failed listen is an uncaught main-process exception; the hook then denies.
  server.on('error', (error) => console.error('Claude permission gate stopped listening', error))
  server.listen(socketPath)
  return {
    hook: {
      event: 'PreToolUse',
      matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit|WebFetch',
      timeout: 86_400,
      file: 'permission-hook.sh',
      script: HOOK.replace('__ARGO_PERMISSION_SOCKET__', socketPath),
    },
    close() {
      const held = waiting.get(sessionId)
      if (held) held.socket.end(decisionLine('deny'))
      waiting.delete(sessionId)
      server.close()
    },
  }
}
