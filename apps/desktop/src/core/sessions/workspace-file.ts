import path from 'node:path'

// A relative path resolves against the workspace, and an absolute one must already lie inside
// it: either way nothing outside the workspace is read, so a link a Feed row carries can open
// while the renderer still names nothing it may not look at.
export function fileInWorkspace(workspace: string, requested: string): string | null {
  const file = path.resolve(workspace, requested)
  const relative = path.relative(workspace, file)
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : file
}
