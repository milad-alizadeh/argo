import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'

export function createMockClaudeHooks(pluginRoot: string | null) {
  async function runHook(file: string, input: unknown) {
    if (pluginRoot === null) return
    const hook = spawn('/bin/sh', [path.join(pluginRoot, file)], {
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    hook.stdin.end(`${JSON.stringify(input)}\n`)
    await once(hook, 'exit')
  }

  return {
    async displayReply(text: string) {
      await runHook('display-hook.sh', {
        turn_id: randomUUID(),
        message_id: randomUUID(),
        index: 0,
        delta: text,
      })
    },
    async waitForPermission() {
      await runHook('permission-hook.sh', {
        tool_name: 'Bash',
        tool_input: { command: 'bun test' },
      })
    },
  }
}
