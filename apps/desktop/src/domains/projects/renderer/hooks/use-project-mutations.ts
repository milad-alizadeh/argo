import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ProjectListReply } from '@/domains/projects/contract/messages'
import {
  type ProjectContractError,
  throwProjectContractError,
} from '@/domains/projects/renderer/project-contract-error'
import {
  projectListQueryKey,
  projectMutationKey,
} from '@/domains/projects/renderer/project-queries'
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
        case 'project.listed':
          queryClient.setQueryData(projectListQueryKey, await cockpitForListing(reply))
          return
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
    mutationFn: () => window.argo.registerProject(),
  })
  const relocate = useMutation<ProjectListReply, ProjectContractError, string>({
    ...mutationOptions,
    mutationKey: projectMutationKey,
    mutationFn: (projectId) => window.argo.relocateProject({ projectId }),
  })
  const selectProject = useMutation<ProjectListReply, ProjectContractError, string>({
    ...mutationOptions,
    mutationKey: projectMutationKey,
    mutationFn: (projectId) => window.argo.selectProject({ projectId }),
  })
  return {
    isPending: register.isPending || relocate.isPending || selectProject.isPending,
    isRunning: () => queryClient.isMutating({ mutationKey: projectMutationKey }) > 0,
    register,
    relocate,
    selectProject,
  }
}
