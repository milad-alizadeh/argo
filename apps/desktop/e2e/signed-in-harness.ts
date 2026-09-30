// One Harness reads signed in through the mock `codex`, so a gated screen opens on a machine with no
// Harness installed. A fixture proving the gate itself overrides both entries.
import { HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { writeMockCodexReadinessCli } from '../mocks/cli/codex/mock-codex-readiness-cli'

export async function signedInHarnessEnvironment(root: string): Promise<Record<string, string>> {
  return {
    [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: await writeMockCodexReadinessCli(root),
    MOCK_CODEX_READINESS_STATE: 'ready',
  }
}
