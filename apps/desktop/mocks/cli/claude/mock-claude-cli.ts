// The Claude adapter's own answers about its mock (#2308): where the executable goes, where the
// transcripts land, and the words the mock answers a prompt with.
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { MockCli } from '../mock-cli'
import { mockClaudeFolder } from './mock-claude-transcripts'

// A run always starts in `apps/desktop`; `import.meta` is unavailable once Playwright loads this as CommonJS.
const MOCK_CLAUDE = path.join(process.cwd(), 'mocks', 'cli', 'claude', 'mock-claude.ts')

// An executable `claude` the packaged app can spawn: this node, running the mock beside this file.
export async function writeMockClaude(root: string, transcripts: string) {
  const executable = path.join(root, 'claude')
  await writeFile(
    executable,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${MOCK_CLAUDE}" "${transcripts}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}

export const mockClaudeCli: MockCli = {
  write: (root, transcripts) => writeMockClaude(root, transcripts),
  folder: mockClaudeFolder,
  replyMark: (prompt) => `Mock Claude read: ${prompt}`,
}
