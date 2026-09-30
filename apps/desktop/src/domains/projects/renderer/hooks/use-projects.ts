import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { type RouterOutputs, trpc } from '@/platform/renderer/trpc-client'

export type ProjectSummary = RouterOutputs['projectList'][number]
// The refusals a Project open can answer with; no other message makes the Cockpit refused.
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

export type CockpitStatus = 'loading' | 'empty' | 'selected' | 'refused'

export type Cockpit = {
  status: CockpitStatus
  project: ProjectSummary | null
  projects: readonly ProjectSummary[]
  message: string | null
  code: ProjectErrorCode | null
  busy: boolean
}

export type ProjectActions = {
  open: () => void
}

export type ProjectCockpit = Cockpit

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
  const open = useCallback(() => {
    if (register.isPending || relocate.isPending) return
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
  }, [navigate, projectCockpit, register, relocate])

  return [projectCockpit, useMemo(() => ({ open }), [open])]
}
