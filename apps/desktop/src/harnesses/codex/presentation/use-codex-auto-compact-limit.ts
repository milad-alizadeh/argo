import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/platform/renderer/trpc-client'
import { DEFAULT_AUTO_COMPACT_LIMIT } from '../auto-compact-limit'

const target = { harness: 'codex' } as const

// The main process reads and writes the limit in the person's own `config.toml`; the renderer keeps no copy.
export function useCodexAutoCompactLimit(): {
  limit: number
  unreadable: boolean
  write: (limit: number) => void
} {
  const queryClient = useQueryClient()
  const read = useQuery(trpc.harnessAutoCompactLimitRead.queryOptions(target))
  const write = useMutation({
    ...trpc.harnessAutoCompactLimitWrite.mutationOptions(),
    onSuccess: (limit) =>
      queryClient.setQueryData(trpc.harnessAutoCompactLimitRead.queryKey(target), limit),
  })
  return {
    limit: read.data ?? DEFAULT_AUTO_COMPACT_LIMIT,
    unreadable: read.isError,
    write: (limit) => write.mutate({ ...target, limit }),
  }
}
