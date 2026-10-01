// The Claude adapter's own answers about its mock (#2308): where the executable goes, the words the
// mock answers a prompt with, and how the Agent SDK reads them back.
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  claudeSessionMessages,
  claudeSessions,
} from '../../../e2e/sessions/real-harness/claude-vendor-reader.ts'
import { CLAUDE_RECORDING_VERSION } from '../../recordings/claude-cli'
import type { MockHarness } from '../mock-cli.ts'
import { claudeConfigDirectory, MOCK_CLAUDE_TRANSCRIPTS_ENV } from './mock-claude-transcripts.ts'

// The version comes from the directory that owns the Claude recordings.
export const MOCK_CLAUDE_VERSION = CLAUDE_RECORDING_VERSION
export const MOCK_CLAUDE_HELP =
  '  --permission-mode <mode> Permission mode to use for the session (choices: "acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan")'

// A run always starts in `apps/desktop`; `import.meta` is unavailable once Playwright loads this as CommonJS.
const MOCK_CLAUDE = path.join(process.cwd(), 'mocks', 'cli', 'claude', 'mock-claude.ts')
// Resolves the fixture's `@/` import, which nothing else does for a file plain `node` runs directly.
const ALIAS_HOOKS = path.join(process.cwd(), 'mocks', 'cli', 'mock-cli-alias-hooks.mts')

// An executable `claude` the packaged app can spawn: this node, running the mock beside this file.
export async function writeMockClaude(root: string, transcripts: string) {
  const executable = path.join(root, 'claude')
  await writeFile(
    executable,
    [
      '#!/bin/sh',
      'case "$1" in',
      `  --version) printf '%s\\n' '${MOCK_CLAUDE_VERSION} (Claude Code)'; exit 0 ;;`,
      `  --help) printf '%s\\n' '${MOCK_CLAUDE_HELP}'; exit 0 ;;`,
      'esac',
      `export ${MOCK_CLAUDE_TRANSCRIPTS_ENV}="${transcripts}"`,
      `exec "${process.execPath}" --no-warnings --import "${ALIAS_HOOKS}" "${MOCK_CLAUDE}" "${transcripts}" "$@"`,
      '',
    ].join('\n'),
  )
  await chmod(executable, 0o755)
  return executable
}

async function recordedByClaude(_root: string, transcripts: string, mark: string) {
  const configDirectory = claudeConfigDirectory(transcripts)
  for (const session of await claudeSessions(configDirectory)) {
    const messages = await claudeSessionMessages(configDirectory, session.sessionId)
    if (messages.some((message) => JSON.stringify(message.message).includes(mark))) return true
  }
  return false
}

export const mockClaudeHarness: MockHarness = {
  write: writeMockClaude,
  replyMark: (prompt) => `Mock Claude read: ${prompt}`,
  recorded: recordedByClaude,
}
