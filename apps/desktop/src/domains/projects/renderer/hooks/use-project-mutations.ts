import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ProjectListReply } from '@/domains/projects/contract/messages'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { type ProjectContractError, throwProjectContractError } from '../project-contract-error'
import { projectListQueryKey, projectMutationKey } from '../project-queries'
import { useProjectSelectionStore } from './use-project-selection-store'
import type { ProjectCockpit } from './use-projects'

export function useProjectMutations(options: {
  cockpitForListing: (
    reply: Extract<ProjectListReply, { type: 'project.listed' }>,
  ) => Promise<ProjectCockpit>
  fallback: ProjectCockpit
  refuse: (previous: ProjectCockpit, reply: ProjectContractError) => ProjectCockpit
}) {
  const { cockpitForListing, fallback, refuse } = options
  const queryClient = useQueryClient()
  const settleMutation = useCallback(
    async (reply: ProjectListReply) => {
      switch (reply.type) {
        case 'project.listed': {
          useProjectSelectionStore.getState().selectProject(reply.selectedId)
          queryClient.setQueryData(projectListQueryKey, await cockpitForListing(reply))
          return
        }
        case 'project.cancelled':
          return
        case 'project.error':
          return throwProjectContractError(reply)
      }
    },
    [cockpitForListing, queryClient],
  )
  const mutationOptions = {
    onSuccess: settleMutation,
    onError: (error: ProjectContractError) => {
      queryClient.setQueryData<ProjectCockpit>(projectListQueryKey, (current) =>
        refuse(current ?? fallback, error),
      )
    },
  }
  const register = useMutation<ProjectListReply, ProjectContractError, void>({
    ...mutationOptions,
    mutationKey: projectMutationKey,
    mutationFn: () => trpcClient.projectRegister.mutate(),
  })
  const relocate = useMutation<ProjectListReply, ProjectContractError, string>({
    ...mutationOptions,
    mutationKey: projectMutationKey,
    mutationFn: (projectId) => trpcClient.projectRelocate.mutate({ projectId }),
  })
  const selectProject = useMutation<ProjectListReply, ProjectContractError, string>({
    ...mutationOptions,
    mutationKey: projectMutationKey,
    mutationFn: (projectId) => trpcClient.projectSelect.mutate({ projectId }),
  })
  return {
    isPending: register.isPending || relocate.isPending || selectProject.isPending,
    isRunning: () => queryClient.isMutating({ mutationKey: projectMutationKey }) > 0,
    register,
    relocate,
    selectProject,
  }
}
