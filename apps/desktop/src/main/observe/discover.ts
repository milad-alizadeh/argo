import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

// The rail shows running + recently-active Sessions only (ADR-0008): a project can hold thousands
// of transcript files, so the sweep reads only those a `stat` says were touched within this window.
export const WORKING_SET_WINDOW_MS = 24 * 60 * 60 * 1000

interface TranscriptFile {
  path: string
  mtimeMs: number
}

export function selectWorkingSet(files: TranscriptFile[], nowMs: number): string[] {
  const oldest = nowMs - WORKING_SET_WINDOW_MS
  return files.filter((file) => file.mtimeMs >= oldest).map((file) => file.path)
}

// Scan every project directory under the CLI transcript root for its recent `*.jsonl` files. A missing
// root (headless CI, a machine that never ran claude) is a clean empty result, never a throw.
export async function discoverWorkingSet(root: string, nowMs: number): Promise<string[]> {
  const projectDirectories = await readDirectoryNames(root)
  const files: TranscriptFile[] = []

  for (const directory of projectDirectories) {
    const projectPath = join(root, directory)
    for (const entry of await readDirectoryNames(projectPath)) {
      if (!entry.endsWith('.jsonl')) continue
      const path = join(projectPath, entry)
      const mtimeMs = await mtimeOf(path)
      if (mtimeMs !== null) files.push({ path, mtimeMs })
    }
  }

  return selectWorkingSet(files, nowMs)
}

async function readDirectoryNames(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

async function mtimeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    return null
  }
}
