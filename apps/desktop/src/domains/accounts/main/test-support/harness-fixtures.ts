// Fixture constants shared by the harness and its dispatch, split out so neither module needs
// the other just to name a project id.
import type {
  ManagedWorkspaceRecovery,
  ProjectRegistry,
  ProjectSetupRecord,
  ProjectStore,
  SetupCheckpoint,
  WorkspaceRecord,
} from '@/domains/projects/main/sqlite-store'

export const PROJECT_ID = 'project-1'
export const OCTOCAT = { id: 583231, login: 'octocat' }
// The first page of the open backlog, unsearched.
export const LIST = { query: '', cursor: null }

type WorkspaceFixtureStore = Pick<
  ProjectStore,
  | 'readWorkspaces'
  | 'writeWorkspace'
  | 'selectWorkspace'
  | 'readWorkspaceSelection'
  | 'writeManagedWorkspaceRecovery'
  | 'readManagedWorkspaceRecovery'
>

export function projectStore(projectId: string): ProjectStore {
  let registry: ProjectRegistry = {
    projects: [{ id: projectId, path: '/tmp/argo-demo', commonDirectory: '/tmp/argo-demo/.git' }],
  }
  let checkpoint: SetupCheckpoint | null = null
  let projectSetup: ProjectSetupRecord | null = null
  const workspace = workspaceStore()
  return {
    read: () => registry,
    replace: (next) => {
      registry = next
    },
    insertProject: (project) => {
      registry = { ...registry, projects: [...registry.projects, project] }
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
    ...workspace,
    close: () => undefined,
  }
}

function workspaceStore(): WorkspaceFixtureStore {
  const workspaces: WorkspaceRecord[] = []
  const selections = new Map<string, string>()
  const recovery = new Map<string, ManagedWorkspaceRecovery>()
  return {
    readWorkspaces: (projectId) =>
      workspaces.filter((workspace) => workspace.projectId === projectId),
    writeWorkspace: (workspace) => {
      const index = workspaces.findIndex(({ id }) => id === workspace.id)
      if (index === -1) workspaces.push(workspace)
      else workspaces[index] = workspace
    },
    selectWorkspace: (projectId, workspaceId) => {
      if (
        !workspaces.some(
          (workspace) => workspace.id === workspaceId && workspace.projectId === projectId,
        )
      ) {
        throw new RangeError('Workspace belongs to another Project')
      }
      selections.set(projectId, workspaceId)
    },
    readWorkspaceSelection: (projectId) => selections.get(projectId) ?? null,
    writeManagedWorkspaceRecovery: (workspace) => {
      if (workspaces.find(({ id }) => id === workspace.workspaceId)?.kind !== 'managed') {
        throw new RangeError('Only managed Workspaces have recovery')
      }
      recovery.set(workspace.workspaceId, workspace)
    },
    readManagedWorkspaceRecovery: (workspaceId) => recovery.get(workspaceId) ?? null,
  }
}
