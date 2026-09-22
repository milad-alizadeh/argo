import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// One command hook of the companion plugin: the script it runs and where Claude Code registers it.
export type CompanionHook = {
  event: 'PreToolUse' | 'MessageDisplay'
  matcher?: string
  timeout?: number
  file: string
  script: string
}

// A channel into one managed Session: its hook, and how to stop listening.
export type CompanionPart = { hook: CompanionHook; close: () => void }

const PLUGIN_MANIFEST = JSON.stringify({
  name: 'argo-companion',
  version: '1.0.0',
  description: "Argo's companion channel into a managed Claude Session.",
})

function hooksFile(pluginRoot: string, hooks: CompanionHook[]) {
  const events: Record<string, unknown[]> = {}
  for (const hook of hooks) {
    const command = { type: 'command', command: `/bin/sh "${path.join(pluginRoot, hook.file)}"` }
    const entry = {
      ...(hook.matcher === undefined ? {} : { matcher: hook.matcher }),
      hooks: [hook.timeout === undefined ? command : { ...command, timeout: hook.timeout }],
    }
    events[hook.event] = [...(events[hook.event] ?? []), entry]
  }
  return JSON.stringify({ hooks: events })
}

// ADR-0024 requires hooks to live in a plugin, not a `--settings` file. Each managed Session gets
// its own plugin directory, so a late answer cannot reach a different Session.
export function openCompanionPlugin(root: string, sessionId: string, parts: CompanionPart[]) {
  const pluginRoot = path.join(root, sessionId)
  rmSync(pluginRoot, { recursive: true, force: true })
  mkdirSync(path.join(pluginRoot, '.claude-plugin'), { recursive: true })
  mkdirSync(path.join(pluginRoot, 'hooks'), { recursive: true })
  const hooks = parts.map((part) => part.hook)
  writeFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), PLUGIN_MANIFEST)
  writeFileSync(path.join(pluginRoot, 'hooks', 'hooks.json'), hooksFile(pluginRoot, hooks))
  for (const hook of hooks) {
    writeFileSync(path.join(pluginRoot, hook.file), hook.script, { mode: 0o700 })
  }
  return {
    pluginRoot,
    close() {
      for (const part of parts) part.close()
      rmSync(pluginRoot, { recursive: true, force: true })
    },
  }
}

// macOS caps a Unix socket path at 104 bytes and userData plus a UUID passes it (#1996).
export function createSocketFolder(channel: string) {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'argo-'))
  return {
    socketPath(sessionId: string) {
      const name = createHash('sha256').update(sessionId).digest('hex').slice(0, 16)
      const socketPath = path.join(folder, `${name}-${channel}.sock`)
      rmSync(socketPath, { force: true })
      return socketPath
    },
    close: () => rmSync(folder, { recursive: true, force: true }),
  }
}
