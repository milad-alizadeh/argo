import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

type WorkspaceListOutput = RouterOutputs['workspaceList']
type WorkspaceListed = Extract<WorkspaceListOutput, { type: 'workspace.listed' }>
export type WorkspaceSummary = WorkspaceListed['workspaces'][number]

export type WorkspaceState = {
  workspaces: readonly WorkspaceSummary[]
  workspace: WorkspaceSummary | null
  choice: string | null
  saveFailed: boolean
}

export type WorkspaceActions = {
  selectWorkspace: (choice: string) => void
}

const IDLE: WorkspaceState = { workspaces: [], workspace: null, choice: null, saveFailed: false }

export function useWorkspaces(projectId: string | null): [WorkspaceState, WorkspaceActions] {
  const queryClient = useQueryClient()
  const [localChoice, setLocalChoice] = useState<{ projectId: string; choice: string } | null>(null)
  const [saveFailureProjectId, setSaveFailureProjectId] = useState<string | null>(null)
  const { mutateAsync: choose } = useMutation(trpc.workspaceChoose.mutationOptions())
  const pendingChoice = useRef(Promise.resolve())
  const query = useQuery({
    ...trpc.workspaceList.queryOptions({ projectId: projectId ?? '' }),
    enabled: projectId !== null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
  const workspaceState = useMemo(() => {
    if (query.data?.type !== 'workspace.listed') return IDLE
    const choice = localChoice?.projectId === projectId ? localChoice.choice : query.data.choice
    const workspace = query.data.workspaces.find((candidate) => candidate.id === choice) ?? null
    return {
      workspaces: query.data.workspaces,
      workspace,
      choice,
      saveFailed: saveFailureProjectId === projectId || (choice !== 'new' && workspace === null),
    }
  }, [query.data, localChoice, projectId, saveFailureProjectId])
  const selectWorkspace = useCallback(
    (choice: string) => {
      if (projectId === null) return
      setLocalChoice({ projectId, choice })
      setSaveFailureProjectId(null)
      pendingChoice.current = pendingChoice.current.then(async () => {
        try {
          await choose({ projectId, choice })
          queryClient.setQueryData<WorkspaceListOutput>(
            trpc.workspaceList.queryKey({ projectId }),
            (current) => (current?.type === 'workspace.listed' ? { ...current, choice } : current),
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
  return [workspaceState, useMemo(() => ({ selectWorkspace }), [selectWorkspace])]
}
