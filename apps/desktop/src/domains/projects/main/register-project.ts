// Registration and relocation. Both open a folder chooser, both prove the choice is a git root,
// and neither ever creates a second identity for a repository that already has one.

import { randomUUID } from 'node:crypto'
import { type ProjectError, projectError } from '@/domains/projects/contract/contract'
import type {
  ProjectListed,
  ProjectListReply,
  ProjectRegisterRequest,
  ProjectRelocateRequest,
} from '@/domains/projects/contract/messages'
import { listed } from '@/domains/projects/main/presentation'
import { repositoryRoot } from '@/domains/projects/main/repository'
import type {
  ProjectRegistration,
  ProjectRegistry,
  ProjectStore as ProjectRegistryStore,
} from '@/domains/projects/main/sqlite-store'

// The dialog is the main process's own authority. It is passed in so that everything below stays
// free of Electron and runs in the ordinary suite. `exclusive` serializes registration and
// relocation, both a read-modify-write, so two started together cannot lose one's change.
export type ProjectStore = {
  projects: ProjectRegistryStore
  chooseFolder: () => Promise<string | null>
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}

export const cancelled = (requestId: string): ProjectListReply => ({
  version: 1,
  type: 'project.cancelled',
  requestId,
})

export async function currentRegistry(
  store: ProjectStore,
  requestId: string,
): Promise<ProjectRegistry | ProjectError> {
  try {
    return store.projects.read()
  } catch {
    return projectError('storage-unavailable', requestId)
  }
}

async function chooseRepository(store: ProjectStore) {
  const folder = await store.chooseFolder()
  if (folder === null) return null
  return repositoryRoot(folder)
}

type Chosen = { root: string; commonDirectory: string; registry: ProjectRegistry }

async function chooseAndReread(
  store: ProjectStore,
  requestId: string,
): Promise<Chosen | ProjectListReply> {
  const chosen = await chooseRepository(store)
  if (chosen === null) return cancelled(requestId)
  if ('failure' in chosen) return projectError(chosen.failure, requestId)
  const registry = await currentRegistry(store, requestId)
  if ('type' in registry) return registry
  return { ...chosen, registry }
}

export async function commit(
  store: ProjectStore,
  requestId: string,
  registry: ProjectRegistry,
): Promise<ProjectListed | ProjectError> {
  try {
    store.projects.replace(registry)
  } catch {
    return projectError('storage-not-written', requestId)
  }
  return listed(requestId, registry)
}

export function registerProject(
  request: ProjectRegisterRequest,
  store: ProjectStore,
): Promise<ProjectListReply> {
  return store.exclusive(async () => {
    // Storage that cannot be read is reported before a chooser opens over it.
    const opened = await currentRegistry(store, request.requestId)
    if ('type' in opened) return opened
    const picked = await chooseAndReread(store, request.requestId)
    if ('type' in picked) return picked
    const { root, commonDirectory, registry } = picked
    // Git's common directory is shared by linked worktrees but differs for independent clones.
    const known = registry.projects.find((project) => project.commonDirectory === commonDirectory)
    const project: ProjectRegistration = known ?? {
      id: `project-${randomUUID()}`,
      path: root,
      commonDirectory,
    }
    const projects = known ? registry.projects : [...registry.projects, project]
    return commit(store, request.requestId, { ...registry, projects, selectedId: project.id })
  })
}

export function relocateProject(
  request: ProjectRelocateRequest,
  store: ProjectStore,
): Promise<ProjectListReply> {
  return store.exclusive(async () => {
    const opened = await currentRegistry(store, request.requestId)
    if ('type' in opened) return opened
    if (!opened.projects.some((project) => project.id === request.projectId)) {
      return projectError('missing-project', request.requestId)
    }
    const picked = await chooseAndReread(store, request.requestId)
    if ('type' in picked) return picked
    const { root, commonDirectory, registry } = picked
    // The identity is checked again on the re-read. A Project another window removed while the
    // chooser was open would otherwise be written back as a selection that names nothing.
    if (!registry.projects.some((project) => project.id === request.projectId)) {
      return projectError('missing-project', request.requestId)
    }
    const taken = registry.projects.find(
      (project) => project.commonDirectory === commonDirectory && project.id !== request.projectId,
    )
    if (taken) return projectError('already-registered', request.requestId)
    // The path moves and the identity does not, which is the whole point of relocation.
    const projects = registry.projects.map((project) =>
      project.id === request.projectId ? { ...project, path: root, commonDirectory } : project,
    )
    return commit(store, request.requestId, {
      ...registry,
      projects,
      selectedId: request.projectId,
    })
  })
}
