import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { type HubEvent, normalizeProjectPath, projectName } from '../shared'

// The one piece of glue Argo owns rather than observes (ADR-0017): the set of known
// Projects and which one is active, as a plain JSON file in per-machine `userData`. Never
// committed — paths and registration are per-machine. Electron-free (the caller supplies
// the file path) so it stays node-testable.

export const REGISTRY_FILENAME = 'projects.json'

export interface ProjectRecord {
  id: string
  path: string
}

export interface ProjectRegistry {
  activeProjectId: string | null
  projects: ProjectRecord[]
}

const emptyRegistry = (): ProjectRegistry => ({ activeProjectId: null, projects: [] })

// A registry that is absent or unparseable is an empty one: a machine that never registered,
// a half-written file, a hand-edit gone wrong. Launching into an empty project strip is
// recoverable. But a genuine read failure (permissions, I/O) must NOT read as empty —
// `registerProject` persists over what it read, so swallowing it would clobber a registry
// that is only temporarily unreadable. Surface that; only ENOENT and bad JSON fall back.
export async function readRegistry(file: string): Promise<ProjectRegistry> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if (isNotFound(error)) return emptyRegistry()
    throw error
  }
  try {
    return parseRegistry(JSON.parse(raw))
  } catch {
    return emptyRegistry()
  }
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

// Registration is the act that creates a Project (CONTEXT.md L1) — a folder is all it
// takes, git optional. Keyed on the folder, so offering the same one again is a no-op
// rather than a second Project.
export async function registerProject(file: string, path: string): Promise<ProjectRegistry> {
  const registry = await readRegistry(file)
  const root = normalizeProjectPath(path)
  if (registry.projects.some((project) => project.path === root)) return registry

  const projects = [...registry.projects, { id: randomUUID(), path: root }]
  return persist(file, {
    activeProjectId: registry.activeProjectId ?? projects[0]?.id ?? null,
    projects,
  })
}

// The id is stable and the path a mutable attribute: a moved folder re-points the Project
// it already had, so every link keyed on the id survives the move.
export async function relocateProject(
  file: string,
  id: string,
  path: string,
): Promise<ProjectRegistry> {
  const registry = await readRegistry(file)
  if (!registry.projects.some((project) => project.id === id)) return registry

  const root = normalizeProjectPath(path)
  return persist(file, {
    ...registry,
    projects: registry.projects.map((project) =>
      project.id === id ? { ...project, path: root } : project,
    ),
  })
}

// What the hub replays on launch to learn the world it can open.
export function toProjectEvents(registry: ProjectRegistry): HubEvent[] {
  const events: HubEvent[] = registry.projects.map((project) => ({
    type: 'project-registered',
    project: { id: project.id, name: projectName(project.path), path: project.path },
  }))
  const { activeProjectId } = registry
  if (activeProjectId !== null) events.push({ type: 'project-activated', id: activeProjectId })
  return events
}

async function persist(file: string, registry: ProjectRegistry): Promise<ProjectRegistry> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  return registry
}

function parseRegistry(raw: unknown): ProjectRegistry {
  if (!isRecord(raw)) return emptyRegistry()
  const projects = Array.isArray(raw.projects) ? raw.projects.filter(isProjectRecord) : []
  return { activeProjectId: knownProjectId(raw.activeProjectId, projects), projects }
}

function knownProjectId(value: unknown, projects: ProjectRecord[]): string | null {
  if (typeof value !== 'string') return null
  return projects.some((project) => project.id === value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  return isRecord(value) && typeof value.id === 'string' && typeof value.path === 'string'
}
