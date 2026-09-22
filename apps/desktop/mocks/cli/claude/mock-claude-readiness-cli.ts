// Where the Harness readiness/sign-in proof's mock `claude` goes (#2579), and the executable
// wrapper that runs it: mirrors `mock-claude-cli.ts`'s own `#!/bin/sh` shim, one node running the
// script beside this file with node's type stripping.
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

// A run always starts in `apps/desktop`; `import.meta` is unavailable once Playwright loads this as CommonJS.
const MOCK_CLAUDE_READINESS = path.join(
  process.cwd(),
  'mocks',
  'cli',
  'claude',
  'mock-claude-readiness.ts',
)

// An executable `claude` the packaged app can spawn for readiness and sign-in; its behavior is
// read from `MOCK_CLAUDE_READINESS_STATE`/`MOCK_CLAUDE_READINESS_LOGIN_HANGS` at spawn time, so one
// executable serves every scenario a proof run points it at.
export async function writeMockClaudeReadinessCli(root: string): Promise<string> {
  const executable = path.join(root, 'claude-readiness')
  await writeFile(
    executable,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${MOCK_CLAUDE_READINESS}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}
