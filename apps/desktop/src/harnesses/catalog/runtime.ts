import { type ActorRefFrom, fromPromise } from 'xstate'
import { readClaudeHarnessInfo } from '@/harnesses/claude/catalog'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { readCodexHarnessInfo } from '@/harnesses/codex/catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/harnesses/proof-protocol'
import {
  type HarnessCatalog,
  type HarnessInfo,
  harnessCatalogSchema,
  unavailable,
} from './harness-catalog-machine'

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
        return harnessCatalogSchema.parse({ harnesses: [claudeInfo, codexInfo] })
      },
    )
  }
}

export const harnessCatalogLoadActor = fromPromise<HarnessCatalog>(({ system }) => {
  const codexActor = system.get('codex') as ActorRefFrom<typeof codexAppServerMachine> | undefined
  if (codexActor === undefined) throw new Error('Codex app-server actor is unavailable.')
  return createHarnessCatalogLoad(() => readCodexHarnessInfo(requestCodexAppServer(codexActor)))()
})
