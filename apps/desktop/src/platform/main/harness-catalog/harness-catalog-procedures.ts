import {
  type AutoCompactLimitLookup,
  autoCompactLimitReadProcedure,
  autoCompactLimitWriteProcedure,
} from './auto-compact-limit'
import { type CatalogActor, catalogReadProcedure, catalogRefreshProcedure } from './catalog-read'

export type HarnessCatalogApiContext = {
  catalog: CatalogActor
  autoCompactLimit: AutoCompactLimitLookup
}

export function harnessCatalogProcedures(context: HarnessCatalogApiContext) {
  return {
    harnessCatalogRead: catalogReadProcedure(context.catalog),
    harnessCatalogRefresh: catalogRefreshProcedure(context.catalog),
    harnessAutoCompactLimitRead: autoCompactLimitReadProcedure(context.autoCompactLimit),
    harnessAutoCompactLimitWrite: autoCompactLimitWriteProcedure(context.autoCompactLimit),
  }
}
