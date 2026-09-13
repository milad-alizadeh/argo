// Registration and relocation. Both open a folder chooser, both prove the choice is a git root,
// and neither ever creates a second identity for a repository that already has one.
import { type ProjectError, type ProjectErrorCode, projectError } from './contract'
import {
  type ProjectListReply,
  projectRegisterRequestSchema,
  projectRelocateRequestSchema,
} from './messages'
import {
  EMPTY_REGISTRY,
  listed,
  newProjectId,
  type Registration,
  type Registry,
  type RegistryRead,
  readRegistry,
  writeRegistry,
} from './registry'
import { repositoryRoot } from './repository'

// The dialog is the main process's own authority. It is passed in so that everything below stays
// free of Electron and runs in the ordinary suite.
export type ProjectStore = {
  registryPath: string
  chooseFolder: () => Promise<string | null>
}

export const cancelled = (requestId: string): ProjectListReply => ({
  version: 1,
  type: 'project.cancelled',
  requestId,
})

// A registry that has never been written is an empty cockpit, not a storage failure. Every other
// read failure is one.
export function openRegistry(read: RegistryRead): Registry | ProjectErrorCode {
  if (read.ok) return read.registry
  if (read.reason === 'missing') return EMPTY_REGISTRY
  return read.reason === 'invalid' ? 'storage-invalid' : 'storage-unavailable'
}

// The chooser is modal and the registry is a file another window of this app can write while it is
// open, so the snapshot the pre-checks read is stale by the time a choice comes back. Every commit
// is built on a re-read rather than on that snapshot.
async function currentRegistry(
  store: ProjectStore,
  requestId: string,
): Promise<Registry | ProjectError> {
  const registry = openRegistry(await readRegistry(store.registryPath))
  return typeof registry === 'string' ? projectError(registry, requestId) : registry
}

async function chooseRepository(store: ProjectStore) {
  const folder = await store.chooseFolder()
  if (folder === null) return null
  return repositoryRoot(folder)
}

type Chosen = { root: string; registry: Registry }

async function chooseAndReread(
  store: ProjectStore,
  requestId: string,
): Promise<Chosen | ProjectListReply> {
  const chosen = await chooseRepository(store)
  if (chosen === null) return cancelled(requestId)
  if ('failure' in chosen) return projectError(chosen.failure, requestId)
  const registry = await currentRegistry(store, requestId)
  if ('type' in registry) return registry
  return { root: chosen.root, registry }
}

async function commit(
  store: ProjectStore,
  requestId: string,
  registry: Registry,
): Promise<ProjectListReply> {
  if (!(await writeRegistry(store.registryPath, registry))) {
    return projectError('storage-not-written', requestId)
  }
  return listed(requestId, registry)
}

export async function registerProject(
  value: unknown,
  store: ProjectStore,
): Promise<ProjectListReply> {
  const parsed = projectRegisterRequestSchema.safeParse(value)
  if (!parsed.success) return projectError('invalid-request', null)
  const request = parsed.data
  // Storage that cannot be read is reported before a chooser opens over it.
  const opened = await currentRegistry(store, request.requestId)
  if ('type' in opened) return opened
  const picked = await chooseAndReread(store, request.requestId)
  if ('type' in picked) return picked
  const { root, registry } = picked
  // One git root is one Project. A folder already registered is selected, never registered twice.
  const known = registry.projects.find((project) => project.path === root)
  const project: Registration = known ?? { id: newProjectId(), path: root }
  const projects = known ? registry.projects : [...registry.projects, project]
  return commit(store, request.requestId, { ...registry, projects, selectedId: project.id })
}

export async function relocateProject(
  value: unknown,
  store: ProjectStore,
): Promise<ProjectListReply> {
  const parsed = projectRelocateRequestSchema.safeParse(value)
  if (!parsed.success) return projectError('invalid-request', null)
  const request = parsed.data
  const opened = await currentRegistry(store, request.requestId)
  if ('type' in opened) return opened
  if (!opened.projects.some((project) => project.id === request.projectId)) {
    return projectError('missing-project', request.requestId)
  }
  const picked = await chooseAndReread(store, request.requestId)
  if ('type' in picked) return picked
  const { root, registry } = picked
  // The identity is checked again on the re-read. A Project another window removed while the
  // chooser was open would otherwise be written back as a selection that names nothing.
  if (!registry.projects.some((project) => project.id === request.projectId)) {
    return projectError('missing-project', request.requestId)
  }
  const taken = registry.projects.find(
    (project) => project.path === root && project.id !== request.projectId,
  )
  if (taken) return projectError('already-registered', request.requestId)
  // The path moves and the identity does not, which is the whole point of relocation.
  const projects = registry.projects.map((project) =>
    project.id === request.projectId ? { ...project, path: root } : project,
  )
  return commit(store, request.requestId, { ...registry, projects, selectedId: request.projectId })
}
