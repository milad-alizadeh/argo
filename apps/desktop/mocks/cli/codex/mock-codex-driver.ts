// Shared by the mock Codex suites: a real child process running mock-codex-app-server.ts stands
// in for `codex app-server`, reached through the real app-server client. Only the CLI is stubbed.
import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createCodexAppServerClient } from '@/harnesses/codex/app-server/codex-app-server-client'
import { MOCK_CODEX_VERSION } from './mock-codex-cli.ts'

// The proof always starts in `apps/desktop`; `import.meta.url` is unavailable once Playwright loads
// this module as CommonJS.
const fixture = path.join(process.cwd(), 'mocks', 'cli', 'codex', 'mock-codex-app-server.ts')
// Resolves the fixture's `@/` import, which nothing else does for a file plain `node` runs directly.
const aliasHooks = path.join(process.cwd(), 'mocks', 'cli', 'mock-cli-alias-hooks.mts')

// A `codex` that answers the version probe, then serves the mock app-server with `env` set.
export async function writeMockCodex(root: string, env: Record<string, string> = {}) {
  const executable = path.join(root, 'codex')
  const exports = Object.entries(env)
    .map(([name, value]) => `export ${name}='${value}'\n`)
    .join('')
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then printf 'codex-cli ${MOCK_CODEX_VERSION}\\n'; exit 0; fi\n${exports}exec "${process.execPath}" --no-warnings --import "${aliasHooks}" "${fixture}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}

export async function mockCodexExecutable(env?: Record<string, string>) {
  return writeMockCodex(await mkdtemp(path.join(os.tmpdir(), 'argo-codex-mock-')), env)
}

// The app-server client every window shares, pointed at one mock executable.
export function clientBackedByMock(executable: string) {
  return createCodexAppServerClient({
    resolveExecutable: async () => ({ executable, version: `codex-cli ${MOCK_CODEX_VERSION}` }),
  })
}
