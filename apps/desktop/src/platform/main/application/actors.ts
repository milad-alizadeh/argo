import { createActor } from 'xstate'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { createHarnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import { createHarnessCatalogLoad } from '@/harnesses/catalog/runtime'
import { executableVersion } from '@/harnesses/cli/executable-version'
import {
  codexAppServerMachine,
  codexAppServerProcessActor,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { readCodexHarnessInfo } from '@/harnesses/codex/catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'

export function startApplicationActors() {
  const findCodexExecutable = () =>
    process.env[SESSION_CODEX_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('codex')
  const codexActor = createActor(
    codexAppServerMachine.provide({
      actors: {
        processActor: codexAppServerProcessActor,
      },
      actions: {
        inspectExecutable: ({ self, event }) => {
          if (event.type !== 'Call') return
          const reportFailure = (error: unknown) => {
            if (self.getSnapshot().status !== 'active') {
              event.reject(new Error('Codex app-server is closed.'))
              return
            }
            self.send({
              type: 'Executable check failed',
              detail: String(error),
              reject: event.reject,
            })
          }
          const reportExecutable = (executable: string | null, version: string | null) => {
            if (self.getSnapshot().status !== 'active') {
              event.reject(new Error('Codex app-server is closed.'))
              return
            }
            self.send({
              type: 'Request',
              executable,
              version,
              run: event.run,
              reject: event.reject,
            })
          }
          try {
            const executable = findCodexExecutable()
            if (executable === null) reportExecutable(null, null)
            else
              void executableVersion(executable).then(
                (version) => reportExecutable(executable, version),
                reportFailure,
              )
          } catch (error) {
            reportFailure(error)
          }
        },
      },
    }),
    { input: { executable: null } },
  ).start()
  const catalogActor = createActor(
    createHarnessCatalogMachine(
      createHarnessCatalogLoad(() => readCodexHarnessInfo(requestCodexAppServer(codexActor))),
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
