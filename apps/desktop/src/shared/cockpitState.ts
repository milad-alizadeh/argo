// The projected state both processes hold (ADR-0005), and the pure transitions over it.
// It is project-keyed (ADR-0015): every fact the cockpit renders is scoped to one Project,
// and a Session belongs to the Project its cwd sits in.

import { type ProjectView, projectForCwd, projectName } from './projects'
import type { SessionFacts } from './sessionFacts'

export type Cli = 'claude' | 'codex'

// What Seam B observed about one Session. `projectId` is absent by construction: the
// observer knows a cwd, only the reducer knows the registered Projects.
export interface SessionIntake {
  id: string
  title: string
  cli: Cli
  cwd: string | null
  facts: SessionFacts
}

// The roster-row view-model: the Session's identity, the FACTS main observed and the
// Project it was attributed to — never a rendered state. The row's word, tone and icon are
// derived from `facts` by the renderer, so no state crosses the bridge pre-graded.
export interface SessionView extends SessionIntake {
  projectId: string | null
}

export interface CockpitState {
  projects: ProjectView[]
  activeProjectId: string | null
  sessions: SessionView[]
}

export const emptyState = (): CockpitState => ({
  projects: [],
  activeProjectId: null,
  sessions: [],
})

export function attribute(projects: ProjectView[], session: SessionIntake): SessionView {
  return { ...session, projectId: projectForCwd(projects, session.cwd) }
}

// Append a Session, idempotent on id: a re-observed Session returns the SAME state
// reference, which both reducers use to decide "nothing changed".
export function addSession(state: CockpitState, session: SessionView): CockpitState {
  if (state.sessions.some((existing) => existing.id === session.id)) return state
  return { ...state, sessions: [...state.sessions, session] }
}

export function addProject(state: CockpitState, project: ProjectView): CockpitState {
  if (state.projects.some((existing) => existing.id === project.id)) return state
  return withProjects(state, [...state.projects, project])
}

// Relocating a folder re-points the path of the SAME Project — the id is stable and the
// path a mutable attribute (CONTEXT.md L1), so a moved repo never registers twice.
export function repointProject(state: CockpitState, id: string, path: string): CockpitState {
  if (!state.projects.some((project) => project.id === id)) return state
  const projects = state.projects.map((project) =>
    project.id === id ? { ...project, path, name: projectName(path) } : project,
  )
  return withProjects(state, projects)
}

export function activateProject(state: CockpitState, id: string): CockpitState {
  if (id === state.activeProjectId) return state
  if (!state.projects.some((project) => project.id === id)) return state
  return { ...state, activeProjectId: id }
}

// Attribution is recomputed for the whole roster because registering or relocating a
// Project changes which Sessions fall inside it — Sessions the launch sweep observed
// before a Project existed must join it rather than stay stranded.
function withProjects(state: CockpitState, projects: ProjectView[]): CockpitState {
  return {
    projects,
    activeProjectId: state.activeProjectId ?? projects[0]?.id ?? null,
    sessions: state.sessions.map((session) => attribute(projects, session)),
  }
}
