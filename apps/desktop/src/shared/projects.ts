// The Project (CONTEXT.md L1, ADR-0015): a registered folder keyed to a stable id, with
// the path as a mutable attribute. The only entity above the Session that Argo owns rather
// than observes. Path handling is hand-rolled rather than `node:path` because the renderer
// imports this module in a browser context, where `node:path` does not resolve.

const SEPARATORS = ['/', '\\']

export interface ProjectView {
  id: string
  name: string
  path: string
}

// One spelling per folder, so `/code/argo` and `/code/argo/` are never two Projects.
export function normalizeProjectPath(path: string): string {
  const trimmed = trimSeparator(path)
  return trimmed === '' ? path : trimmed
}

// The folder name, so relocating a Project renames it instead of stranding the old label.
export function projectName(path: string): string {
  const trimmed = trimSeparator(path)
  if (trimmed === '') return path
  const cut = Math.max(...SEPARATORS.map((separator) => trimmed.lastIndexOf(separator)))
  return trimmed.slice(cut + 1)
}

// Which Project a Session belongs to, resolved from its cwd — DIRECT, never a user choice
// (ADR-0015). The innermost containing Project wins, so a Project vendored inside another
// claims its own sessions. A cwd inside no registered Project is unattributed, never guessed.
export function projectForCwd(projects: ProjectView[], cwd: string | null): string | null {
  if (cwd === null) return null
  const containing = projects.filter((project) => contains(project.path, cwd))
  const depth = (project: ProjectView): number => trimSeparator(project.path).length
  const innermost = containing.reduce<ProjectView | null>(
    (deepest, project) => (deepest && depth(deepest) >= depth(project) ? deepest : project),
    null,
  )
  return innermost?.id ?? null
}

function contains(projectPath: string, cwd: string): boolean {
  const root = trimSeparator(projectPath)
  const candidate = trimSeparator(cwd)
  if (candidate === root) return true
  return SEPARATORS.some((separator) => candidate.startsWith(root + separator))
}

function trimSeparator(path: string): string {
  let end = path.length
  while (end > 0 && SEPARATORS.includes(path[end - 1] ?? '')) end -= 1
  return path.slice(0, end)
}
