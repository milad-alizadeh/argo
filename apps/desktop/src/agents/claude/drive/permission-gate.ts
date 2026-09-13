import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { z } from 'zod'
import type { ClaudePermission } from '@/core/sessions/contract'

export type ClaudePermissionGate = {
  open: (sessionId: string) => { pluginRoot: string; close: () => void }
  pending: (sessionId: string) => ClaudePermission | null
  decide: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
}

const PLUGIN_MANIFEST = JSON.stringify({
  name: 'argo-companion',
  version: '1.0.0',
  description: "Argo's companion permission channel.",
})

const HOOKS = JSON.stringify({
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit|WebFetch',
        hooks: [
          {
            type: 'command',
            command: '/bin/sh "__ARGO_PERMISSION_HOOK__"',
            timeout: 86_400,
          },
        ],
      },
    ],
  },
})

const HOOK = `#!/bin/sh
deny() { printf '%s\\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}'; }
hold=$(mktemp -d) || { deny; exit 1; }
trap 'kill "$writer" "$dialler" 2>/dev/null; rm -rf "$hold"' EXIT
mkfifo "$hold/request" || { deny; exit 1; }
{
  tr '\\n' ' '
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

// ADR-0024 requires the hook to live in a plugin, not a `--settings` file. Each managed Session
// gets its own Unix socket and plugin directory, so a late answer cannot reach a different turn.
export function createClaudePermissionGate(root: string): ClaudePermissionGate {
  const waiting = new Map<string, { permission: ClaudePermission; socket: net.Socket }>()

  return {
    open(sessionId) {
      const pluginRoot = path.join(root, sessionId)
      const socketPath = path.join(root, `${sessionId}.permission.sock`)
      rmSync(pluginRoot, { recursive: true, force: true })
      rmSync(socketPath, { force: true })
      mkdirSync(path.join(pluginRoot, '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(pluginRoot, 'hooks'), { recursive: true })
      const hookPath = path.join(pluginRoot, 'permission-hook.sh')
      writeFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), PLUGIN_MANIFEST)
      writeFileSync(
        path.join(pluginRoot, 'hooks', 'hooks.json'),
        HOOKS.replace('__ARGO_PERMISSION_HOOK__', hookPath),
      )
      writeFileSync(hookPath, HOOK.replace('__ARGO_PERMISSION_SOCKET__', socketPath), {
        mode: 0o700,
      })
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
      server.listen(socketPath)
      return {
        pluginRoot,
        close() {
          const held = waiting.get(sessionId)
          if (held) held.socket.end(decisionLine('deny'))
          waiting.delete(sessionId)
          server.close()
          rmSync(socketPath, { force: true })
          rmSync(pluginRoot, { recursive: true, force: true })
        },
      }
    },
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
  }
}
