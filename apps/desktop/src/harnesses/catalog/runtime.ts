import { fromPromise } from 'xstate'
import type { HarnessRegistry } from '@/harnesses/registry'
import {
  type HarnessCatalog,
  harnessCatalogMachine,
  harnessCatalogSchema,
  unavailable,
} from './harness-catalog-machine'

export function createHarnessCatalogLoad(registrations: HarnessRegistry) {
  return async () => {
    const [claudeResult, codexResult] = await Promise.allSettled([
      registrations.claude.readCatalog(),
      registrations.codex.readCatalog(),
    ])
    const claudeInfo =
      claudeResult.status === 'fulfilled' ? claudeResult.value : unavailable('claude')
    const codexInfo = codexResult.status === 'fulfilled' ? codexResult.value : unavailable('codex')
    return harnessCatalogSchema.parse({ harnesses: [claudeInfo, codexInfo] })
  }
}

export function createHarnessCatalogMachine(registrations: HarnessRegistry) {
  return harnessCatalogMachine.provide({
    actors: {
      loadCatalog: fromPromise<HarnessCatalog>(() => createHarnessCatalogLoad(registrations)()),
    },
  })
}
