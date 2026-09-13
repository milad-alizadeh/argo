import type { ClaudeTurnSetup } from '@/core/sessions/contract.ts'
import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'
import { CYCLE_MODE, REDRAW } from '../drive/claude-setup.ts'

export const OPENING: ClaudeTurnSetup = { model: 'opus', effort: 'high', mode: 'manual' }
// The Modes this fake offers, in the order Shift+Tab reaches them.
export const FOOTERS = ['manual mode on', 'accept edits on', 'plan mode on', 'auto mode on']

// A Claude TUI that redraws its Mode footer on Ctrl+L, advanced one Mode per Shift+Tab.
export function fakeClaude() {
  const writes: string[] = []
  const calls: { command: string; commandArguments: string[]; environment: NodeJS.ProcessEnv }[] =
    []
  let listener: (data: string) => void = () => {}
  let footer = 0
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    schedule: (callback) => callback(),
    spawn: (command, commandArguments, options) => {
      calls.push({ command, commandArguments, environment: options.env })
      return {
        write: (text) => {
          writes.push(text)
          if (text === CYCLE_MODE) footer = (footer + 1) % FOOTERS.length
          if (text === REDRAW) listener(`\u001b[2J\u001b[38;5;246m⏵⏵ ${FOOTERS[footer]}\u001b[39m`)
        },
        onData: (next) => {
          listener = next
        },
      }
    },
  })
  return { calls, driver, writes }
}

export const settle = () => new Promise((resolve) => setImmediate(resolve))

// A started Session whose opening Turn has gone out, with the writes cleared.
export async function startedSession() {
  const claude = fakeClaude()
  const sessionId = claude.driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  claude.writes.length = 0
  return { ...claude, sessionId }
}
