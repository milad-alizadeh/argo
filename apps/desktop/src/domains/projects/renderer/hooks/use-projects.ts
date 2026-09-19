import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ProjectError, ProjectErrorCode } from '@/domains/projects/contract/contract'
import type { ProjectListed, ProjectSummary } from '@/domains/projects/contract/messages'
import { useProjectMutations } from '@/domains/projects/renderer/hooks/use-project-mutations'
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
  message: string | null
  code: ProjectErrorCode | null
  busy: boolean
}

export type ProjectActions = { open: () => void; select: (projectId: string) => void }

const IDLE = { project: null, projects: [], message: null, code: null, busy: false } as const
const LOADING: Cockpit = { status: 'loading', ...IDLE }
const EMPTY: Cockpit = { status: 'empty', ...IDLE }

function refuse(previous: Cockpit, reply: ProjectError | ProjectContractError): Cockpit {
  const status = previous.status === 'loading' ? 'empty' : previous.status
  return { ...previous, status, message: reply.message, code: reply.code, busy: false }
}

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

export function useProjects(): [Cockpit, ProjectActions] {
  const projects = useProjectListing()
  const mutations = useProjectMutations({ cockpitForListing, fallback: LOADING, refuse })

  const queryCockpit = projects.data ?? LOADING
  const error = projects.error
  const cockpit = useMemo(
    () => ({ ...(error ? refuse(queryCockpit, error) : queryCockpit), busy: mutations.isPending }),
    [error, mutations.isPending, queryCockpit],
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

  return [cockpit, useMemo(() => ({ open, select }), [open, select])]
}
