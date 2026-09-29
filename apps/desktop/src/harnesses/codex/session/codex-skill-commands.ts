// Codex has no command list on the app-server. Skills are the directories under the user
// skill folder and each project's `.agents/skills`. The description is frontmatter only.
import { type Dirent, existsSync, type FSWatcher, watch } from 'node:fs'
import { open, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  type ComposerCommand,
  readComposerCommands,
} from '@/domains/sessions/api/composer-commands'

const SKILL_NAME = /^[\w][\w.-]*$/

function isEnoent(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function projectFolders(cwd: string): string[] {
  const folders: string[] = []
  for (let folder = cwd; ; folder = path.dirname(folder)) {
    folders.push(folder)
    if (existsSync(path.join(folder, '.git'))) return folders.reverse()
    if (path.dirname(folder) === folder) return [cwd]
  }
}

export function codexSkillHome(codexHome?: string) {
  return codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
}

export function codexSkillRoots(cwd: string | null, codexHome: string): string[] {
  const roots = [path.join(codexHome, 'skills')]
  if (cwd === null) return roots
  return [...roots, ...projectFolders(cwd).map((folder) => path.join(folder, '.agents', 'skills'))]
}

async function skillDescription(file: string): Promise<string> {
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
  const frontmatter = end === -1 ? text : text.slice(0, end)
  const match = frontmatter.match(/^description:\s*(.+)$/m)
  return match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

async function skillRow(
  root: string,
  entry: Dirent,
  reading: { seen: Set<string>; reject: (shape: string) => void },
): Promise<unknown | null> {
  if (entry.name.startsWith('.')) return null
  if (!entry.isDirectory() && !entry.isSymbolicLink()) return null
  if (!SKILL_NAME.test(entry.name)) {
    reading.reject('codex-skill')
    return null
  }
  if (reading.seen.has(entry.name)) return null
  reading.seen.add(entry.name)
  return {
    name: entry.name,
    description: await skillDescription(path.join(root, entry.name, 'SKILL.md')),
    argumentHint: '',
  }
}

async function commandsInRoot(
  root: string,
  seen: Set<string>,
  reject: (shape: string) => void,
): Promise<unknown[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (!isEnoent(error)) reject('codex-skill-root')
    return []
  }
  const rows: unknown[] = []
  for (const entry of entries) {
    const row = await skillRow(root, entry, { seen, reject })
    if (row !== null) rows.push(row)
  }
  return rows
}

export async function readCodexSkillCommands(input: {
  cwd: string | null
  codexHome?: string
  reject?: (shape: string) => void
}): Promise<ComposerCommand[]> {
  const reject = input.reject ?? (() => {})
  const codexHome = codexSkillHome(input.codexHome)
  const rows: unknown[] = []
  const seen = new Set<string>()
  for (const root of codexSkillRoots(input.cwd, codexHome))
    rows.push(...(await commandsInRoot(root, seen, reject)))
  return readComposerCommands(rows, reject)
}

export function followCodexSkillCommands(input: {
  cwd: string
  closed: () => boolean
  onCommands: (commands: ComposerCommand[]) => void
  reject?: (shape: string) => void
}): () => void {
  let stopped = false
  let stopWatch: (() => void) | null = null
  void readCodexSkillCommands(input).then((commands) => {
    if (stopped || input.closed()) return
    input.onCommands(commands)
    stopWatch = watchCodexSkillCommands({
      cwd: input.cwd,
      reject: input.reject,
      onChange: (next) => {
        if (!stopped && !input.closed()) input.onCommands(next)
      },
    })
  })
  return () => {
    stopped = true
    stopWatch?.()
  }
}

export function watchCodexSkillCommands(input: {
  cwd: string | null
  codexHome?: string
  reject?: (shape: string) => void
  onChange: (commands: ComposerCommand[]) => void
}): () => void {
  const codexHome = codexSkillHome(input.codexHome)
  const watchers: FSWatcher[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const refresh = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      void readCodexSkillCommands(input).then(input.onChange)
    }, 50)
  }
  for (const root of codexSkillRoots(input.cwd, codexHome)) {
    try {
      const watcher = watch(root, refresh)
      watcher.on('error', () => {})
      watchers.push(watcher)
    } catch {
      // A missing skill folder is an empty list, not a watch.
    }
  }
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    for (const watcher of watchers) watcher.close()
  }
}
