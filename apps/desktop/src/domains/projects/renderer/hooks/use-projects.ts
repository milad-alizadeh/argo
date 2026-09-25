import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PROJECT_ERROR_CODES, type ProjectErrorCode } from '@/domains/projects/contract/contract'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import type { WorkspaceSummary } from '@/domains/projects/contract/workspace-messages'
import { trpc } from '@/platform/renderer/trpc-client'
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
  selectWorkspace: (workspaceId: string) => void
  createManagedWorkspace: (baseRef: string) => void
}

export type ProjectCockpit = Omit<Cockpit, 'workspace' | 'workspaces'>

const IDLE = { project: null, projects: [], message: null, code: null, busy: false } as const
const LOADING: ProjectCockpit = { status: 'loading', ...IDLE }
const EMPTY: ProjectCockpit = { status: 'empty', ...IDLE }

function useProjectListing() {
  const query = useQuery(trpc.projectList.queryOptions())
  return {
    ...query,
    data: query.data ? ({ ...EMPTY, projects: query.data } satisfies ProjectCockpit) : undefined,
  }
}

export function useProjects(): [Cockpit, ProjectActions] {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const queryClient = useQueryClient()
  const projects = useProjectListing()
  const projectOpen = useQuery({
    ...trpc.projectOpen.queryOptions(projectId ?? ''),
    enabled: projectId !== undefined,
  })
  const mutationOptions = { onSuccess: () => queryClient.invalidateQueries(), onError: () => {} }
  const register = useMutation({ ...trpc.projectRegister.mutationOptions(), ...mutationOptions })
  const relocate = useMutation({ ...trpc.projectRelocate.mutationOptions(), ...mutationOptions })

  const queryCockpit = projects.data ?? LOADING
  const project =
    queryCockpit.projects.find((candidate) => candidate.id === projectId) ??
    (projectId === undefined ? (queryCockpit.projects[0] ?? null) : null)
  const openErrorCode = PROJECT_ERROR_CODES.includes(projectOpen.error?.message as ProjectErrorCode)
    ? (projectOpen.error?.message as ProjectErrorCode)
    : null
  const projectCockpit = useMemo(() => {
    const base = queryCockpit
    if (project === null)
      return {
        ...base,
        project: null,
        status: (base.status === 'loading' ? 'loading' : 'empty') as CockpitStatus,
        busy: register.isPending || relocate.isPending,
      }
    if (openErrorCode && project) {
      return { ...base, project, status: 'refused' as const, code: openErrorCode, busy: false }
    }
    return {
      ...base,
      project,
      status: 'selected' as const,
      busy: register.isPending || relocate.isPending,
    }
  }, [openErrorCode, project, queryCockpit, register.isPending, relocate.isPending])
  const [workspaces, workspaceActions] = useWorkspaces(
    projectCockpit.status === 'selected' ? (projectCockpit.project?.id ?? null) : null,
  )
  const cockpit = useMemo(
    () => ({ ...projectCockpit, ...workspaces }),
    [projectCockpit, workspaces],
  )

  const open = useCallback(() => {
    if (queryClient.isMutating() > 0) return
    if (projectCockpit.status === 'refused' && projectCockpit.project) {
      relocate.mutate(projectCockpit.project.id)
      return
    }
    register.mutate(undefined, {
      onSuccess: (projects) => {
        const registered = projects.at(-1)
        if (registered) navigate(`/projects/${registered.id}/sessions`)
      },
    })
  }, [navigate, projectCockpit, queryClient, register, relocate])

  return [cockpit, useMemo(() => ({ open, ...workspaceActions }), [open, workspaceActions])]
}
