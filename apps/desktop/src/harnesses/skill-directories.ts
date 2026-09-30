// A skill directory is a folder of `name/SKILL.md`. The description is frontmatter only.
import type { Dirent } from 'node:fs'
import { open, readdir } from 'node:fs/promises'
import path from 'node:path'
import { linkedWorktreeMain, projectFolders } from '@/harnesses/project-folders'

const SKILL_NAME = /^[\w][\w.-]*$/

type SkillDirectoryReading = {
  seen: Set<string>
  reject: (shape: string) => void
  entryShape: string
  rootShape: string
}

function isEnoent(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function descriptionValue(frontmatter: string) {
  const match = frontmatter.match(/^description:\s*(.*)$/m)
  if (match === null) return ''
  const value = match[1]?.trim() ?? ''
  if (value !== '|' && value !== '|-' && value !== '>' && value !== '>-') {
    return value.replace(/^["']|["']$/g, '')
  }
  const after = frontmatter.slice((match.index ?? 0) + match[0].length)
  return (
    after
      .match(/\n[ \t]+(.+)/)?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, '') ?? ''
  )
}

async function skillFrontmatterDescription(file: string): Promise<string> {
  let text = ''
  try {
    const handle = await open(file, 'r')
    try {
      const buffer = Buffer.alloc(4096)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      text = buffer.toString('utf8', 0, bytesRead)
    } finally {
      await handle.close()
    }
  } catch {
    return ''
  }
  if (!text.startsWith('---')) return ''
  const end = text.indexOf('\n---', 3)
  return descriptionValue(end === -1 ? text : text.slice(0, end))
}

async function skillRow(
  root: string,
  entry: Dirent,
  reading: SkillDirectoryReading,
): Promise<unknown | null> {
  if (entry.name.startsWith('.')) return null
  if (!entry.isDirectory() && !entry.isSymbolicLink()) return null
  if (!SKILL_NAME.test(entry.name)) {
    reading.reject(reading.entryShape)
    return null
  }
  if (reading.seen.has(entry.name)) return null
  reading.seen.add(entry.name)
  return {
    name: entry.name,
    description: await skillFrontmatterDescription(path.join(root, entry.name, 'SKILL.md')),
    argumentHint: '',
  }
}

async function rowsInRoot(root: string, reading: SkillDirectoryReading): Promise<unknown[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (!isEnoent(error)) reading.reject(reading.rootShape)
    return []
  }
  const rows: unknown[] = []
  for (const entry of entries) {
    const row = await skillRow(root, entry, reading)
    if (row !== null) rows.push(row)
  }
  return rows
}

// Personal skills, then this checkout, then the main checkout of a linked worktree.
export function skillRoots(cwd: string | null, personal: string, project: string): string[] {
  if (cwd === null) return [personal]
  const projects = projectFolders(cwd)
  const roots = [personal, ...projects.map((folder) => path.join(folder, project))]
  const main = linkedWorktreeMain(projects[0] ?? cwd)
  if (main === null) return roots
  return [...roots, path.join(main, project)]
}

// Personal roots come first. The first directory of a name wins.
export async function readSkillDirectoryRows(input: {
  roots: readonly string[]
  reject: (shape: string) => void
  entryShape: string
  rootShape: string
}): Promise<unknown[]> {
  const rows: unknown[] = []
  const seen = new Set<string>()
  for (const root of input.roots) {
    rows.push(
      ...(await rowsInRoot(root, {
        seen,
        reject: input.reject,
        entryShape: input.entryShape,
        rootShape: input.rootShape,
      })),
    )
  }
  return rows
}
