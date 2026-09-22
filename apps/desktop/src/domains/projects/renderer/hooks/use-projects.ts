import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ProjectError, ProjectErrorCode } from '@/domains/projects/contract/contract'
import type { ProjectListed, ProjectSummary } from '@/domains/projects/contract/messages'
import type { WorkspaceSummary } from '@/domains/projects/contract/workspace-messages'
import { useProjectMutations } from '@/domains/projects/renderer/hooks/use-project-mutations'
import { useWorkspaces } from '@/domains/projects/renderer/hooks/use-workspaces'
import {
  type ProjectContractError,
  throwProjectContractError,
} from '@/domains/projects/renderer/project-contract-error'
import { projectListQueryKey } from '@/domains/projects/renderer/project-queries'

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
  const project = reply.projects.find((candidate) => candidate.id === reply.selectedId)
  if (!project) return { ...EMPTY, projects: reply.projects }
  const opened = await window.argo.openProject({ projectId: project.id })
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
