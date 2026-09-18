// Fixture constants shared by the harness and its dispatch, split out so neither module needs
// the other just to name a project id.
import type { ProjectRegistry, ProjectStore } from '@/domains/projects/main/sqlite-store'

export const PROJECT_ID = 'project-1'
export const OCTOCAT = { id: 583231, login: 'octocat' }
// The first page of the open backlog, unsearched.
export const LIST = { query: '', cursor: null }

export function projectStore(projectId: string): ProjectStore {
  let registry: ProjectRegistry = {
    projects: [{ id: projectId, path: '/tmp/argo-demo', commonDirectory: '/tmp/argo-demo/.git' }],
    selectedId: projectId,
  }
  return {
    read: () => registry,
    replace: (next) => {
      registry = next
    },
    close: () => undefined,
  }
}
