import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

type WorktreeListOutput = RouterOutputs['worktreeList']
type WorktreeListed = Extract<WorktreeListOutput, { type: 'worktree.listed' }>
export type WorktreeSummary = WorktreeListed['worktrees'][number]

// `choice` is 'new', 'main', or the path of an existing linked worktree.
export type WorktreeChoiceState = {
  worktrees: readonly WorktreeSummary[]
  choice: string | null
  saveFailed: boolean
}

export type WorktreeChoiceActions = {
  selectWorktree: (choice: string) => void
}

const IDLE: WorktreeChoiceState = { worktrees: [], choice: null, saveFailed: false }

function offered(worktrees: readonly WorktreeSummary[], choice: string): boolean {
  return choice === 'new' || choice === 'main' || worktrees.some((tree) => tree.path === choice)
}

export function useWorktreeChoices(
  projectId: string | null,
): [WorktreeChoiceState, WorktreeChoiceActions] {
  const queryClient = useQueryClient()
  const [localChoice, setLocalChoice] = useState<{ projectId: string; choice: string } | null>(null)
  const [saveFailureProjectId, setSaveFailureProjectId] = useState<string | null>(null)
  const { mutateAsync: choose } = useMutation(trpc.worktreeChoose.mutationOptions())
  const pendingChoice = useRef(Promise.resolve())
  const query = useQuery({
    ...trpc.worktreeList.queryOptions({ projectId: projectId ?? '' }),
    enabled: projectId !== null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
  const state = useMemo(() => {
    if (query.data?.type !== 'worktree.listed') return IDLE
    const choice = localChoice?.projectId === projectId ? localChoice.choice : query.data.choice
    return {
      worktrees: query.data.worktrees,
      choice,
      saveFailed: saveFailureProjectId === projectId || !offered(query.data.worktrees, choice),
    }
  }, [query.data, localChoice, projectId, saveFailureProjectId])
  const selectWorktree = useCallback(
    (choice: string) => {
      if (projectId === null) return
      setLocalChoice({ projectId, choice })
      setSaveFailureProjectId(null)
      pendingChoice.current = pendingChoice.current.then(async () => {
        try {
          await choose({ projectId, choice })
          queryClient.setQueryData<WorktreeListOutput>(
            trpc.worktreeList.queryKey({ projectId }),
            (current) => (current?.type === 'worktree.listed' ? { ...current, choice } : current),
          )
          setLocalChoice((current) =>
            current?.projectId === projectId && current.choice === choice ? null : current,
          )
          setSaveFailureProjectId((current) => (current === projectId ? null : current))
        } catch {
          setLocalChoice((current) =>
            current?.projectId === projectId && current.choice === choice ? null : current,
          )
          setSaveFailureProjectId(projectId)
        }
      })
    },
    [choose, projectId, queryClient],
  )
  return [state, useMemo(() => ({ selectWorktree }), [selectWorktree])]
}
