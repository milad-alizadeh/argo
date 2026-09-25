import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type {
  ProjectWorkspaceListed,
  WorkspaceSummary,
} from '@/domains/projects/contract/workspace-messages'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { type ProjectContractError, throwProjectContractError } from '../project-contract-error'

export type WorkspaceCockpit = {
  workspaces: readonly WorkspaceSummary[]
  workspace: WorkspaceSummary | null
}

export type WorkspaceActions = {
  selectWorkspace: (workspaceId: string) => void
  createManagedWorkspace: (baseRef: string) => void
}

const IDLE: WorkspaceCockpit = { workspaces: [], workspace: null }

function workspaceQueryKey(projectId: string) {
  return ['projects', projectId, 'workspaces'] as const
}

// AC5: a Project with no remembered selection, or whose remembered selection no longer names a
// Workspace, opens into a fresh managed Workspace rather than leaving the composer without one.
async function resolveWorkspaces(projectId: string): Promise<ProjectWorkspaceListed> {
  const reply = await trpcClient.projectWorkspaceList.query({ projectId })
  if (reply.type === 'project.error') return throwProjectContractError(reply)
  const selected = reply.workspaces.some((workspace) => workspace.id === reply.selectedId)
  if (selected) return reply
  const created = await trpcClient.projectWorkspaceCreateManaged.mutate({
    projectId,
    baseRef: 'HEAD',
  })
  if (created.type === 'project.error') return throwProjectContractError(created)
  return created
}

function cockpitOf(reply: ProjectWorkspaceListed): WorkspaceCockpit {
  return {
    workspaces: reply.workspaces,
    workspace: reply.workspaces.find((candidate) => candidate.id === reply.selectedId) ?? null,
  }
}

export function useWorkspaces(projectId: string | null): [WorkspaceCockpit, WorkspaceActions] {
  const queryClient = useQueryClient()
  const queryKey = workspaceQueryKey(projectId ?? '')

  const query = useQuery<ProjectWorkspaceListed, ProjectContractError>({
    ...trpc.projectWorkspaceList.queryOptions({ projectId: projectId ?? '' }),
    queryKey,
    enabled: projectId !== null,
    staleTime: Infinity,
    retry: false,
    queryFn: () => resolveWorkspaces(projectId as string),
  })

  const mutationOptions = {
    mutationKey: queryKey,
    onSuccess: (reply: ProjectWorkspaceListed) => queryClient.setQueryData(queryKey, reply),
  }
  const select = useMutation<ProjectWorkspaceListed, ProjectContractError, string>({
    ...trpc.projectWorkspaceSelect.mutationOptions(),
    ...mutationOptions,
    mutationFn: async (workspaceId) => {
      const reply = await trpcClient.projectWorkspaceSelect.mutate({
        projectId: projectId as string,
        workspaceId,
      })
      return reply.type === 'project.error' ? throwProjectContractError(reply) : reply
    },
  })
  const createManaged = useMutation<ProjectWorkspaceListed, ProjectContractError, string>({
    ...trpc.projectWorkspaceCreateManaged.mutationOptions(),
    ...mutationOptions,
    mutationFn: async (baseRef) => {
      const reply = await trpcClient.projectWorkspaceCreateManaged.mutate({
        projectId: projectId as string,
        baseRef,
      })
      return reply.type === 'project.error' ? throwProjectContractError(reply) : reply
    },
  })

  const cockpit = useMemo(() => (query.data ? cockpitOf(query.data) : IDLE), [query.data])
  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      if (projectId !== null) select.mutate(workspaceId)
    },
    [projectId, select],
  )
  const createManagedWorkspace = useCallback(
    (baseRef: string) => {
      if (projectId !== null) createManaged.mutate(baseRef)
    },
    [projectId, createManaged],
  )

  return [
    cockpit,
    useMemo(
      () => ({ selectWorkspace, createManagedWorkspace }),
      [selectWorkspace, createManagedWorkspace],
    ),
  ]
}
