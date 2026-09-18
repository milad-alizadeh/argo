// The cockpit's whole picture of the Project surface. Every action answers with the entire known
// set (src/projects/messages.ts), so one settle turns any reply into the next screen and the
// renderer never assembles storage out of a sequence of replies.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ProjectError, ProjectErrorCode } from '@/domains/projects/contract/contract'
import type {
  ProjectListed,
  ProjectListReply,
  ProjectSummary,
} from '@/domains/projects/contract/messages'
import { type ProjectContractError, throwProjectContractError } from '../project-contract-error'
import { projectListQueryKey, projectMutationKey } from '../project-queries'

export type CockpitStatus = 'loading' | 'empty' | 'selected' | 'setup' | 'refused'

// A refusal keeps its code as well as its text. The text is what a person reads; the code is what
// the screen is named by, so a capture and a proof cannot report a git failure under the name of a
// folder that holds no repository.
export type Cockpit = {
  status: CockpitStatus
  project: ProjectSummary | null
  projects: readonly ProjectSummary[]
  message: string | null
  code: ProjectErrorCode | null
  busy: boolean
}

// One action, because what opening a Project means depends on the screen: with a refused Project
// on it, the folder the person picks is that Project's new home rather than a new Project.
export type ProjectActions = { open: () => void; select: (projectId: string) => void }

const IDLE = { project: null, projects: [], message: null, code: null, busy: false } as const
const LOADING: Cockpit = { status: 'loading', ...IDLE }
const EMPTY: Cockpit = { status: 'empty', ...IDLE }

function refuse(previous: Cockpit, reply: ProjectError): Cockpit {
  const status = previous.status === 'loading' ? 'empty' : previous.status
  return { ...previous, status, message: reply.message, code: reply.code, busy: false }
}

// Opening is what proves the registered folder is still reachable, so it runs on every listing
// rather than only on the first one. A refusal keeps the identity: relocation needs it.
async function cockpitForListing(reply: ProjectListed): Promise<Cockpit> {
  const project = reply.projects.find((candidate) => candidate.id === reply.selectedId)
  if (!project) return { ...EMPTY, projects: reply.projects }
  const opened = await window.argo.openProject({ projectId: project.id })
  if (opened.type === 'project.error') {
    const { message, code } = opened
    return { status: 'refused', project, projects: reply.projects, message, code, busy: false }
  }
  if (opened.type === 'project.setup-required') {
    return {
      status: 'setup',
      project,
      projects: reply.projects,
      message: null,
      code: null,
      busy: false,
    }
  }
  return {
    status: 'selected',
    project,
    projects: reply.projects,
    message: null,
    code: null,
    busy: false,
  }
}

function useProjectListing() {
  return useQuery<Cockpit, ProjectContractError>({
    queryKey: projectListQueryKey,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const reply = await window.argo.listProjects()
      switch (reply.type) {
        case 'project.listed':
          return cockpitForListing(reply)
        case 'project.error':
          return throwProjectContractError(reply)
        case 'project.cancelled':
          throw new Error('Argo cancelled a Project listing.')
      }
    },
  })
}

function useProjectMutationCallbacks() {
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
    [queryClient],
  )
  return {
    onSuccess: settleMutation,
    onError: (error: ProjectContractError) => {
      queryClient.setQueryData<Cockpit>(projectListQueryKey, (current = LOADING) =>
        refuse(current, error),
      )
    },
  }
}

function useProjectMutations() {
  const queryClient = useQueryClient()
  const mutationOptions = useProjectMutationCallbacks()
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

export function useProjects(): [Cockpit, ProjectActions] {
  const projects = useProjectListing()
  const mutations = useProjectMutations()

  const queryCockpit = projects.data ?? LOADING
  const error = projects.error
  // A native folder chooser stays open while its mutation is pending. Keeping the cached refusal
  // in place is what prevents its Project identity and message vanishing underneath the chooser.
  const cockpit = useMemo(
    () => ({ ...(error ? refuse(queryCockpit, error) : queryCockpit), busy: mutations.isPending }),
    [error, mutations.isPending, queryCockpit],
  )

  // The menu item, the chord and the deck's own control are one action (apps/desktop/AGENTS.md), so
  // what a refused Project offers on screen is what the chord does.
  const open = useCallback(() => {
    if (mutations.isRunning()) return
    const { status, project } = cockpit
    if (status === 'refused' && project) {
      mutations.relocate.mutate(project.id)
      return
    }
    mutations.register.mutate()
  }, [cockpit, mutations])

  const select = useCallback(
    (projectId: string) => {
      if (!mutations.isRunning()) mutations.selectProject.mutate(projectId)
    },
    [mutations],
  )

  return [cockpit, useMemo(() => ({ open, select }), [open, select])]
}
