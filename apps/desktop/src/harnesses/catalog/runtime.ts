import { createActor } from 'xstate'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
} from '@/domains/sessions/contract/proof-protocol'
import { readClaudeHarnessInfo } from '@/harnesses/claude/catalog'
import { createCodexAppServer } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import {
  catalogSnapshot,
  createHarnessCatalogMachine,
  unavailable,
} from './harness-catalog-machine'

const codexExecutable = () =>
  process.env[SESSION_CODEX_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('codex')
const codex = createCodexAppServer(codexExecutable)
codex.actor.start()

export function loadHarnessCatalog() {
  const claudeExecutable =
    process.env[SESSION_CLAUDE_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('claude')
  return Promise.allSettled([
    readClaudeHarnessInfo(claudeExecutable),
    codex.readHarnessInfo(),
  ]).then(([claudeResult, codexResult]) => {
    const claudeInfo =
      claudeResult.status === 'fulfilled' ? claudeResult.value : unavailable('claude')
    const codexInfo = codexResult.status === 'fulfilled' ? codexResult.value : unavailable('codex')
    return catalogSnapshot([claudeInfo, codexInfo])
  })
}

export const harnessCatalogActor = createActor(createHarnessCatalogMachine(loadHarnessCatalog))
harnessCatalogActor.start()

export function stopHarnessCatalog(): void {
  harnessCatalogActor.stop()
  codex.close()
}
