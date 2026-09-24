import { createActor } from 'xstate'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { createHarnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import { createHarnessCatalogLoad } from '@/harnesses/catalog/runtime'
import { createCodexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { readCodexHarnessInfo } from '@/harnesses/codex/catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'

export function startApplicationActors() {
  const findCodexExecutable = () =>
    process.env[SESSION_CODEX_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('codex')
  const codex = createCodexAppServerMachine(findCodexExecutable)
  const codexActor = createActor(codex.machine, {
    input: { executable: findCodexExecutable() },
  }).start()
  const catalogActor = createActor(
    createHarnessCatalogMachine(
      createHarnessCatalogLoad(() => readCodexHarnessInfo(codex.request(codexActor))),
    ),
  ).start()
  return {
    catalogActor,
    codexRequest: codex.request(codexActor),
    stop: () => {
      catalogActor.stop()
      codexActor.send({ type: 'Shutdown' })
      codexActor.stop()
    },
  }
}

export type ApplicationActors = ReturnType<typeof startApplicationActors>
