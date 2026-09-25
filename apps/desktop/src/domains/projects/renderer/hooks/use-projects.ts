import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ProjectError, ProjectErrorCode } from '@/domains/projects/contract/contract'
import type { ProjectListed, ProjectSummary } from '@/domains/projects/contract/messages'
import type { WorkspaceSummary } from '@/domains/projects/contract/workspace-messages'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { type ProjectContractError, throwProjectContractError } from '../project-contract-error'
import { projectListQueryKey } from '../project-queries'
import { useProjectMutations } from './use-project-mutations'
import { useProjectSelectionStore } from './use-project-selection-store'
import { useWorkspaces } from './use-workspaces'

export type CockpitStatus = 'loading' | 'empty' | 'selected' | 'setup' | 'refused'

export type Cockpit = {
  status: CockpitStatus
  project: ProjectSummary | null
  projects: readonly ProjectSummary[]
  workspace: WorkspaceSummary | null
  workspaces: readonly WorkspaceSummary[]
  message: string | null
  code: ProjectErrorCode | null
  busy: boolean
}

export type ProjectActions = {
  open: () => void
  select: (projectId: string) => void
  selectWorkspace: (workspaceId: string) => void
  createManagedWorkspace: (baseRef: string) => void
}

export type ProjectCockpit = Omit<Cockpit, 'workspace' | 'workspaces'>

const IDLE = { project: null, projects: [], message: null, code: null, busy: false } as const
const LOADING: ProjectCockpit = { status: 'loading', ...IDLE }
const EMPTY: ProjectCockpit = { status: 'empty', ...IDLE }

function refuse(
  previous: ProjectCockpit,
  reply: ProjectError | ProjectContractError,
): ProjectCockpit {
  const status = previous.status === 'loading' ? 'empty' : previous.status
  return { ...previous, status, message: null, code: reply.code, busy: false }
}

async function cockpitForListing(reply: ProjectListed): Promise<ProjectCockpit> {
  const persistedId = useProjectSelectionStore.getState().selectedProjectId
  const selectedId = reply.projects.some((candidate) => candidate.id === persistedId)
    ? persistedId
    : reply.selectedId
  const project = reply.projects.find((candidate) => candidate.id === selectedId)
  useProjectSelectionStore.getState().selectProject(project?.id ?? null)
  if (project && reply.selectedId !== project.id) {
    const selected = await trpcClient.projectSelect.mutate({ projectId: project.id })
    if (selected.type !== 'project.listed') return { ...EMPTY, projects: reply.projects }
  }
  if (!project) return { ...EMPTY, projects: reply.projects }
  const opened = await trpcClient.projectOpen.query({ projectId: project.id })
  if (opened.type === 'project.error') {
    return {
      status: 'refused',
      project,
      projects: reply.projects,
      message: null,
      code: opened.code,
      busy: false,
    }
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
  return useQuery<ProjectCockpit, ProjectContractError>({
    queryKey: projectListQueryKey,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const reply = await trpcClient.projectList.query()
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

export function useProjects(): [Cockpit, ProjectActions] {
  const projects = useProjectListing()
  const mutations = useProjectMutations({ cockpitForListing, fallback: LOADING, refuse })

  const queryCockpit = projects.data ?? LOADING
  const error = projects.error
  const projectCockpit = useMemo(
    () => ({ ...(error ? refuse(queryCockpit, error) : queryCockpit), busy: mutations.isPending }),
    [error, mutations.isPending, queryCockpit],
  )
  const [workspaces, workspaceActions] = useWorkspaces(
    projectCockpit.status === 'selected' ? (projectCockpit.project?.id ?? null) : null,
  )
  const cockpit = useMemo(
    () => ({ ...projectCockpit, ...workspaces }),
    [projectCockpit, workspaces],
  )

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

  return [
    cockpit,
    useMemo(() => ({ open, select, ...workspaceActions }), [open, select, workspaceActions]),
  ]
}
