import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

type WorkspaceListOutput = RouterOutputs['workspaceList']
type WorkspaceListed = Extract<WorkspaceListOutput, { type: 'workspace.listed' }>
export type WorkspaceSummary = WorkspaceListed['workspaces'][number]

export type WorkspaceCockpit = {
  workspaces: readonly WorkspaceSummary[]
  workspace: WorkspaceSummary | null
}

export type WorkspaceActions = {
  selectWorkspace: (workspaceId: string) => void
}

const IDLE: WorkspaceCockpit = { workspaces: [], workspace: null }

export function useWorkspaces(projectId: string | null): [WorkspaceCockpit, WorkspaceActions] {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useQuery({
    ...trpc.workspaceList.queryOptions({ projectId: projectId ?? '' }),
    enabled: projectId !== null,
    staleTime: Infinity,
  })
  const cockpit = useMemo(() => {
    if (query.data?.type !== 'workspace.listed') return IDLE
    const workspace =
      query.data.workspaces.find((candidate) => candidate.id === selectedId) ??
      query.data.workspaces.find((candidate) => candidate.kind === 'main') ??
      null
    return { workspaces: query.data.workspaces, workspace }
  }, [query.data, selectedId])
  const selectWorkspace = useCallback((workspaceId: string) => setSelectedId(workspaceId), [])
  return [cockpit, useMemo(() => ({ selectWorkspace }), [selectWorkspace])]
}
