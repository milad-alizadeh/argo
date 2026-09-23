// Shared by the #1839 vertical-slice tests: a real child process running
// mock-codex-app-server.ts stands in for `codex app-server`, wired through the real
// CodexChannel transport rather than an in-memory mock.
import { spawn } from 'node:child_process'
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { OwnershipLedger } from '@/domains/sessions/main/lifecycle/ownership/ownership-ledger'
import { createCodexSessionDriver } from '@/harnesses/codex/drive/session/codex-session-driver'
import { channelForAppServerProcess } from '@/harnesses/codex/drive/supervision/open-app-server'
import { MOCK_CODEX_MODEL_CATALOG } from './fixtures/mock-codex-model-catalog.ts'

// The proof always starts in `apps/desktop`, as `session-resume-case.ts`'s mock Claude notes:
// `import.meta.url` is unavailable once the Playwright test runner loads this module as CommonJS.
const fixture = path.join(process.cwd(), 'mocks', 'cli', 'codex', 'mock-codex-app-server.ts')
// Resolves the fixture's `@/` import, which nothing else does for a file plain `node` runs directly.
const aliasHooks = path.join(process.cwd(), 'mocks', 'cli', 'mock-cli-alias-hooks.mts')

export function driverBackedByFixture(
  driverOptions: {
    ownership?: OwnershipLedger
    env?: Record<string, string>
    resumeTarget?: (sessionId: string) => Promise<{ cwd: string } | null>
  } = {},
) {
  return createCodexSessionDriver({
    findExecutable: () => process.execPath,
    readModelCatalog: async () => MOCK_CODEX_MODEL_CATALOG,
    now: () => new Date(),
    ownership: driverOptions.ownership,
    resumeTarget: driverOptions.resumeTarget ?? (async () => null),
    openChannel: (executable, options) => {
      const child = spawn(executable, [fixture], {
        cwd: options.cwd,
        env: { ...options.env, ...driverOptions.env },
      })
      child.stderr.on('data', () => {})
      return channelForAppServerProcess(child)
    },
  })
}

export async function ownerHarnessFor() {
  return 'codex'
}

export async function writeMockCodex(root: string) {
  const executable = `${root}/codex`
  const vendorHistory = path.join(root, 'argo-vendor-history.json')
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then printf 'codex 0.147.0\\n'; exit 0; fi\nARGO_CODEX_VENDOR_HISTORY="${vendorHistory}" exec "${process.execPath}" --no-warnings --import "${aliasHooks}" "${fixture}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}
