// Fixture constants shared by the harness and its dispatch, split out so neither module needs
// the other just to name a project id.
import type {
  ProjectRegistry,
  ProjectSetupRecord,
  ProjectStore,
  SetupCheckpoint,
} from '@/domains/projects/main/sqlite-store'

export const PROJECT_ID = 'project-1'
export const OCTOCAT = { id: 583231, login: 'octocat' }
// The first page of the open backlog, unsearched.
export const LIST = { query: '', cursor: null }

export function projectStore(projectId: string): ProjectStore {
  let registry: ProjectRegistry = {
    projects: [{ id: projectId, path: '/tmp/argo-demo', commonDirectory: '/tmp/argo-demo/.git' }],
    selectedId: projectId,
  }
  let checkpoint: SetupCheckpoint | null = null
  let projectSetup: ProjectSetupRecord | null = null
  return {
    read: () => registry,
    replace: (next) => {
      registry = next
    },
    insertProject: (project) => {
      registry = { ...registry, projects: [...registry.projects, project] }
    },
    selectProject: (projectId) => {
      registry = { ...registry, selectedId: projectId }
    },
    updateProjectPath: (projectId, projectPath) => {
      registry = {
        ...registry,
        projects: registry.projects.map((project) =>
          project.id === projectId ? { ...project, path: projectPath } : project,
        ),
      }
    },
    promoteSetupWorktree: (projectId, worktreePath) => {
      registry = {
        ...registry,
        projects: registry.projects.map((project) =>
          project.id === projectId ? { ...project, path: worktreePath } : project,
        ),
      }
      if (checkpoint?.projectId === projectId) checkpoint = { ...checkpoint, phase: 'ready' }
    },
    readSetupCheckpoint: (id) => (checkpoint?.projectId === id ? checkpoint : null),
    writeSetupCheckpoint: (next) => {
      checkpoint = next
    },
    readProjectSetup: (id) => (projectSetup?.projectId === id ? projectSetup : null),
    writeProjectSetup: (next) => {
      projectSetup = next
    },
    close: () => undefined,
  }
}
