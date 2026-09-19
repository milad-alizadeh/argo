import { expect, test } from 'bun:test'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { openCompanionPlugin } from '@/agents/claude/drive/companion-plugin'
import { createMessageDisplay } from '@/agents/claude/drive/message-display'
import { createClaudePermissionGate } from '@/agents/claude/drive/permission-gate'

type Registered = { matcher?: string; hooks: { command: string }[] }

// Runs a registered hook command the way Claude Code does: the input on stdin, stdout read back.
function run(command: string, input: unknown) {
  return new Promise<string>((resolve) => {
    const child = execFile('/bin/sh', ['-c', command], (_error, stdout) => resolve(stdout))
    child.stdin?.end(JSON.stringify(input))
  })
}

async function until<T>(read: () => T | null): Promise<T> {
  for (;;) {
    const value = read()
    if (value !== null) return value
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

test('one companion plugin carries the permission hook and the MessageDisplay hook', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-companion-'))
  const gate = createClaudePermissionGate()
  const display = createMessageDisplay()
  const sessionId = randomUUID()
  const batches: unknown[] = []
  const plugin = openCompanionPlugin(root, sessionId, [
    gate.open(sessionId),
    display.open(sessionId, (batch) => batches.push(batch)),
  ])
  const registered = JSON.parse(
    await readFile(path.join(plugin.pluginRoot, 'hooks', 'hooks.json'), 'utf8'),
  ) as { hooks: Record<string, Registered[]> }
  const command = (event: string) => registered.hooks[event]?.[0]?.hooks[0]?.command ?? ''

  const batch = { turn_id: 'turn-1', message_id: 'ducks', index: 0, final: false, delta: 'Ducks.' }
  const shown = await run(command('MessageDisplay'), batch)
  const reply = run(command('PreToolUse'), {
    tool_name: 'Bash',
    tool_input: { command: 'bun test' },
  })
  const permission = await until(() => gate.pending(sessionId))
  gate.decide(sessionId, permission.id, 'allow')

  expect(shown).toBe('')
  expect(batches).toEqual([batch])
  expect(permission).toMatchObject({ sessionId, toolName: 'Bash' })
  expect(await reply).toContain('"permissionDecision":"allow"')
  expect(registered.hooks.MessageDisplay?.[0]?.matcher).toBeUndefined()
  plugin.close()
  gate.close()
  display.close()
  await rm(root, { recursive: true, force: true })
})
