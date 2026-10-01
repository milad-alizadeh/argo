import { useQueries } from '@tanstack/react-query'
import { HARNESSES, type Harness } from '@/harnesses/harness'
import type { CatalogReadResult } from '@/harnesses/harness-catalog'
import { trpc } from '@/platform/renderer/trpc-client'

function availableHarnesses(
  results: readonly { isPending: boolean; data?: CatalogReadResult | undefined }[],
) {
  if (results.some((result) => result.isPending)) return null
  return HARNESSES.filter((_, index) => results[index]?.data?.info.availability === 'available')
}

// The Harnesses that can start a Session, in registry order; null until every catalog read answers.
export function useAvailableHarnesses(): readonly Harness[] | null {
  return useQueries({
    queries: HARNESSES.map((harness) => trpc.harnessCatalogRead.queryOptions({ harness })),
    combine: availableHarnesses,
  })
}
