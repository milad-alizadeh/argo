import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

export type ProjectSummary = RouterOutputs['projectList'][number]
// A Project open can return only these refusals.
const PROJECT_ERROR_CODES = [
  'missing-project',
  'missing-workspace',
  'access-denied',
  'invalid-request',
  'unsupported-version',
  'project-unavailable',
  'internal-error',
  'storage-invalid',
  'storage-unavailable',
  'invalid-response',
  'connection-lost',
  'not-a-repository',
  'already-registered',
  'git-unavailable',
  'storage-not-written',
  'invalid-configuration',
  'setup-unavailable',
  'setup-network-unavailable',
  'setup-document-invalid',
  'onboarding-run-not-found',
  'onboarding-harness-unavailable',
] as const
type ProjectErrorCode = (typeof PROJECT_ERROR_CODES)[number]

type ProjectsStatus = 'loading' | 'empty' | 'selected' | 'refused'

export type ProjectsState = {
  status: ProjectsStatus
  project: ProjectSummary | null
  projects: readonly ProjectSummary[]
  message: string | null
  code: ProjectErrorCode | null
  busy: boolean
}

export type ProjectActions = {
  open: () => void
}

const IDLE = { project: null, projects: [], message: null, code: null, busy: false } as const
const LOADING: ProjectsState = { status: 'loading', ...IDLE }
const EMPTY: ProjectsState = { status: 'empty', ...IDLE }

function useProjectListing() {
  const query = useQuery(trpc.projectList.queryOptions())
  return {
    ...query,
    data: query.data ? ({ ...EMPTY, projects: query.data } satisfies ProjectsState) : undefined,
  }
}

export function useProjects(): [ProjectsState, ProjectActions] {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const queryClient = useQueryClient()
  const projects = useProjectListing()
  const projectOpen = useQuery({
    ...trpc.projectOpen.queryOptions(projectId ?? ''),
    enabled: projectId !== undefined,
  })
  // The reads a Project change moves; Session reads follow main's change signal instead.
  const onSuccess = () =>
    Promise.all(
      [trpc.projectList, trpc.projectOpen, trpc.workspaceList].map((procedure) =>
        queryClient.invalidateQueries({ queryKey: procedure.pathKey() }),
      ),
    )
  const mutationOptions = { onSuccess, onError: () => {} }
  const register = useMutation({ ...trpc.projectRegister.mutationOptions(), ...mutationOptions })
  const relocate = useMutation({ ...trpc.projectRelocate.mutationOptions(), ...mutationOptions })

  const queryProjects = projects.data ?? LOADING
  const project =
    queryProjects.projects.find((candidate) => candidate.id === projectId) ??
    (projectId === undefined ? (queryProjects.projects[0] ?? null) : null)
  const openErrorCode = PROJECT_ERROR_CODES.includes(projectOpen.error?.message as ProjectErrorCode)
    ? (projectOpen.error?.message as ProjectErrorCode)
    : null
  const projectState = useMemo(() => {
    const base = queryProjects
    if (project === null)
      return {
        ...base,
        project: null,
        status: (base.status === 'loading' ? 'loading' : 'empty') as ProjectsStatus,
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
  }, [openErrorCode, project, queryProjects, register.isPending, relocate.isPending])
  const open = useCallback(() => {
    if (register.isPending || relocate.isPending) return
    if (projectState.status === 'refused' && projectState.project) {
      relocate.mutate(projectState.project.id)
      return
    }
    register.mutate(undefined, {
      onSuccess: (projects) => {
        const registered = projects.at(-1)
        if (registered) navigate(`/projects/${registered.id}/sessions`)
      },
    })
  }, [navigate, projectState, register, relocate])

  return [projectState, useMemo(() => ({ open }), [open])]
}
