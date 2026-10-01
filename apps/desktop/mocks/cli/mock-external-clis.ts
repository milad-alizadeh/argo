import { realpathSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mockClaudeAgentsCli } from './claude/mock-claude-agents'
import { clientBackedByMock, writeMockCodex } from './codex/mock-codex-driver'
import { isolateHarnessFolders } from './real-user-config'

// Throwaway Harness folders with the mock `claude agents` CLI and a mock Codex app-server, as an
// external Session test needs; `dispose` ends both and deletes the folders.
export async function mockExternalClis(
  prefix: string,
  codexEnvironment: (root: string) => Record<string, string> = () => ({}),
) {
  const root = realpathSync(await mkdtemp(path.join(os.tmpdir(), prefix)))
  const restoreFolders = isolateHarnessFolders(root)
  const agents = mockClaudeAgentsCli()
  const codex = clientBackedByMock(
    await writeMockCodex(root, {
      CODEX_HOME: process.env.CODEX_HOME as string,
      ...codexEnvironment(root),
    }),
  )
  return {
    root,
    agents,
    codex,
    dispose: async () => {
      codex.shutdown()
      agents.dispose()
      restoreFolders()
      await rm(root, { recursive: true, force: true })
    },
  }
}
