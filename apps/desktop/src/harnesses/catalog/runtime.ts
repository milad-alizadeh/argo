import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { readClaudeHarnessInfo } from '@/harnesses/claude/catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { catalogSnapshot, type HarnessInfo, unavailable } from './harness-catalog-machine'

export function createHarnessCatalogLoad(readCodex: () => Promise<HarnessInfo>) {
  return async () => {
    const claudeExecutable =
      process.env[SESSION_CLAUDE_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('claude')
    return Promise.allSettled([readClaudeHarnessInfo(claudeExecutable), readCodex()]).then(
      ([claudeResult, codexResult]) => {
        const claudeInfo =
          claudeResult.status === 'fulfilled' ? claudeResult.value : unavailable('claude')
        const codexInfo =
          codexResult.status === 'fulfilled' ? codexResult.value : unavailable('codex')
        return catalogSnapshot([claudeInfo, codexInfo])
      },
    )
  }
}
